-- Persistent campaign streak tracking with cadence foundation.
-- Supports weekly (active now), and biweekly/monthly (for future UI controls).

alter table public.campaigns
  add column if not exists streak_count integer not null default 0;

alter table public.campaigns
  add column if not exists streak_cadence text not null default 'weekly';

alter table public.campaigns
  add column if not exists streak_last_period_start date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campaigns_streak_count_non_negative'
      and conrelid = 'public.campaigns'::regclass
  ) then
    alter table public.campaigns
      add constraint campaigns_streak_count_non_negative
      check (streak_count >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campaigns_streak_cadence_valid'
      and conrelid = 'public.campaigns'::regclass
  ) then
    alter table public.campaigns
      add constraint campaigns_streak_cadence_valid
      check (streak_cadence in ('weekly', 'biweekly', 'monthly'));
  end if;
end $$;

create or replace function public.campaign_period_start(
  p_date date,
  p_cadence text
)
returns date
language plpgsql
immutable
as $$
declare
  v_week_start date;
  v_epoch_monday constant date := date '1970-01-05';
begin
  if p_cadence = 'monthly' then
    return date_trunc('month', p_date)::date;
  end if;

  v_week_start := date_trunc('week', p_date)::date;

  if p_cadence = 'biweekly' then
    return v_epoch_monday + (((v_week_start - v_epoch_monday) / 14) * 14);
  end if;

  return v_week_start;
end;
$$;

create or replace function public.next_campaign_period_start(
  p_period_start date,
  p_cadence text
)
returns date
language plpgsql
immutable
as $$
begin
  if p_cadence = 'monthly' then
    return (p_period_start + interval '1 month')::date;
  end if;

  if p_cadence = 'biweekly' then
    return p_period_start + 14;
  end if;

  return p_period_start + 7;
end;
$$;

create or replace function public.apply_campaign_streak_for_date(
  p_campaign_id uuid,
  p_activity_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cadence text;
  v_last_period_start date;
  v_new_period_start date;
  v_new_streak_count integer;
begin
  select c.streak_cadence, c.streak_last_period_start
    into v_cadence, v_last_period_start
  from public.campaigns c
  where c.id = p_campaign_id
  for update;

  if not found then
    return;
  end if;

  v_new_period_start := public.campaign_period_start(coalesce(p_activity_date, current_date), v_cadence);

  if v_last_period_start is null then
    v_new_streak_count := 1;
  elsif v_new_period_start = v_last_period_start then
    return;
  elsif v_new_period_start = public.next_campaign_period_start(v_last_period_start, v_cadence) then
    v_new_streak_count := (
      select c.streak_count + 1
      from public.campaigns c
      where c.id = p_campaign_id
    );
  elsif v_new_period_start > v_last_period_start then
    v_new_streak_count := 1;
  else
    return;
  end if;

  perform set_config('app.allow_streak_write', '1', true);

  update public.campaigns c
  set
    streak_count = greatest(0, coalesce(v_new_streak_count, 0)),
    streak_last_period_start = v_new_period_start
  where c.id = p_campaign_id;
end;
$$;

create or replace function public.protect_campaign_streak_fields()
returns trigger
language plpgsql
as $$
begin
  if (
    new.streak_count is distinct from old.streak_count
    or new.streak_last_period_start is distinct from old.streak_last_period_start
    or new.streak_cadence is distinct from old.streak_cadence
  )
  and coalesce(current_setting('app.allow_streak_write', true), '0') <> '1' then
    raise exception 'Campaign streak fields are managed by the system';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_campaign_streak_fields on public.campaigns;
create trigger trg_protect_campaign_streak_fields
  before update on public.campaigns
  for each row
  execute function public.protect_campaign_streak_fields();

create or replace function public.apply_campaign_streak_on_session_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived then
    return new;
  end if;

  perform public.apply_campaign_streak_for_date(
    new.campaign_id,
    coalesce(new.session_date, (new.created_at at time zone 'utc')::date, current_date)
  );

  return new;
end;
$$;

drop trigger if exists trg_apply_campaign_streak_on_session_insert on public.sessions;
create trigger trg_apply_campaign_streak_on_session_insert
  after insert on public.sessions
  for each row
  execute function public.apply_campaign_streak_on_session_insert();

-- Backfill streaks from existing non-archived sessions.
do $$
declare
  v_campaign record;
  v_periods date[];
  v_len integer;
  v_idx integer;
  v_streak integer;
begin
  for v_campaign in
    select c.id, c.streak_cadence
    from public.campaigns c
  loop
    select array_agg(p.period_start order by p.period_start desc)
      into v_periods
    from (
      select distinct public.campaign_period_start(
        coalesce(s.session_date, (s.created_at at time zone 'utc')::date),
        v_campaign.streak_cadence
      ) as period_start
      from public.sessions s
      where s.campaign_id = v_campaign.id
        and not s.archived
    ) p;

    v_len := coalesce(array_length(v_periods, 1), 0);

    if v_len = 0 then
      continue;
    end if;

    v_streak := 1;

    for v_idx in 2..v_len loop
      exit when v_periods[v_idx - 1] <> public.next_campaign_period_start(v_periods[v_idx], v_campaign.streak_cadence);
      v_streak := v_streak + 1;
    end loop;

    perform set_config('app.allow_streak_write', '1', true);

    update public.campaigns c
    set
      streak_count = v_streak,
      streak_last_period_start = v_periods[1]
    where c.id = v_campaign.id;
  end loop;
end $$;

