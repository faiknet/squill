-- Fix streak logic: 6 bugs addressed
-- 1. Same-period actions no longer increment (was regression from 20260615)
-- 2. Gap > 1 period resets streak_last_period_start to NULL (enables fresh start at 1)
-- 3. Add session_notes trigger (note edits now count as streak actions)
-- 4. Add entity_tags trigger (journal entity additions now count as streak actions)
-- 5. recalculate_campaign_streak now checks for streak expiry
-- 6. Full backfill recalculates all campaigns (not just those with streak <= 1)

-- ============================================================
-- 1. Rewrite core streak function
-- ============================================================

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

  v_new_period_start := public.campaign_period_start(
    coalesce(p_activity_date, current_date), v_cadence
  );

  -- No prior activity → start streak at 1
  if v_last_period_start is null then
    v_new_streak_count := 1;

  -- Same period → no change (no-op)
  elsif v_new_period_start = v_last_period_start then
    return;

  -- Consecutive period → increment
  elsif v_new_period_start = public.next_campaign_period_start(
    v_last_period_start, v_cadence
  ) then
    v_new_streak_count := (
      select c.streak_count + 1 from public.campaigns c where c.id = p_campaign_id
    );

  -- Gap > 1 period → expired, start new streak at 1
  elsif v_new_period_start > v_last_period_start then
    v_new_streak_count := 1;

  -- Past activity (activity_date before last_period) → no-op
  else
    return;
  end if;

  perform set_config('app.allow_streak_write', '1', true);

  update public.campaigns c
  set
    streak_count = coalesce(v_new_streak_count, 0),
    streak_last_period_start = v_new_period_start
  where c.id = p_campaign_id;
end;
$$;

-- ============================================================
-- 2. Add session_notes streak trigger
-- ============================================================

create or replace function public.apply_campaign_streak_on_session_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_session_date date;
  v_cadence text;
  v_period_days integer;
begin
  select s.campaign_id, coalesce(s.session_date, (s.created_at at time zone 'utc')::date)
    into v_campaign_id, v_session_date
  from public.sessions s
  where s.id = new.session_id;

  if v_campaign_id is not null then
    select c.streak_cadence into v_cadence
    from public.campaigns c
    where c.id = v_campaign_id;

    v_period_days := case
      when v_cadence = 'biweekly' then 14
      when v_cadence = 'monthly' then 28
      else 7
    end;

    if current_date - v_session_date <= v_period_days then
      perform public.apply_campaign_streak_for_date(
        v_campaign_id, v_session_date
      );
    else
      perform public.apply_campaign_streak_for_date(
        v_campaign_id, current_date
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_campaign_streak_on_session_note on public.session_notes;
create trigger trg_apply_campaign_streak_on_session_note
  after insert or update on public.session_notes
  for each row
  execute function public.apply_campaign_streak_on_session_note();

-- ============================================================
-- 3. Add entity_tags streak trigger
-- ============================================================

create or replace function public.apply_campaign_streak_on_entity_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_date date;
  v_cadence text;
  v_period_days integer;
begin
  select coalesce(s.session_date, (s.created_at at time zone 'utc')::date)
    into v_session_date
  from public.sessions s
  where s.id = new.session_id;

  select c.streak_cadence into v_cadence
  from public.campaigns c
  where c.id = new.campaign_id;

  v_period_days := case
    when v_cadence = 'biweekly' then 14
    when v_cadence = 'monthly' then 28
    else 7
  end;

  if current_date - v_session_date <= v_period_days then
    perform public.apply_campaign_streak_for_date(
      new.campaign_id, v_session_date
    );
  else
    perform public.apply_campaign_streak_for_date(
      new.campaign_id, current_date
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_campaign_streak_on_entity_tag on public.entity_tags;
create trigger trg_apply_campaign_streak_on_entity_tag
  after insert on public.entity_tags
  for each row
  execute function public.apply_campaign_streak_on_entity_tag();

-- ============================================================
-- 4. Fix recalculate_campaign_streak (add expiry check)
-- ============================================================

create or replace function public.recalculate_campaign_streak(
  p_campaign_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cadence text;
  v_periods date[];
  v_len integer;
  v_idx integer;
  v_streak integer;
begin
  select c.streak_cadence
    into v_cadence
  from public.campaigns c
  where c.id = p_campaign_id;

  if not found then
    return;
  end if;

  select array_agg(p.period_start order by p.period_start desc)
    into v_periods
  from (
    select distinct public.campaign_period_start(
      coalesce(s.session_date, (s.created_at at time zone 'utc')::date),
      v_cadence
    ) as period_start
    from public.sessions s
    where s.campaign_id = p_campaign_id
      and not s.archived
  ) p;

  v_len := coalesce(array_length(v_periods, 1), 0);

  perform set_config('app.allow_streak_write', '1', true);

  if v_len = 0 then
    update public.campaigns c
    set
      streak_count = 0,
      streak_last_period_start = null
    where c.id = p_campaign_id;
    return;
  end if;

  v_streak := 1;
  for v_idx in 2..v_len loop
    exit when v_periods[v_idx - 1] <> public.next_campaign_period_start(v_periods[v_idx], v_cadence);
    v_streak := v_streak + 1;
  end loop;

  -- Check if streak has expired (gap between most recent period and current period)
  if public.next_campaign_period_start(v_periods[1], v_cadence) < current_date then
    v_streak := 0;
  end if;

  if v_streak = 0 then
    update public.campaigns c
    set
      streak_count = 0,
      streak_last_period_start = null
    where c.id = p_campaign_id;
  else
    update public.campaigns c
    set
      streak_count = v_streak,
      streak_last_period_start = v_periods[1]
    where c.id = p_campaign_id;
  end if;
end;
$$;

-- ============================================================
-- 5. Full backfill: recalculate all campaigns from scratch
-- ============================================================

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

    perform set_config('app.allow_streak_write', '1', true);

    if v_len = 0 then
      update public.campaigns c
      set streak_count = 0, streak_last_period_start = null
      where c.id = v_campaign.id;
      continue;
    end if;

    -- Count consecutive periods from the most recent
    v_streak := 1;
    for v_idx in 2..v_len loop
      exit when v_periods[v_idx - 1] <> public.next_campaign_period_start(
        v_periods[v_idx], v_campaign.streak_cadence
      );
      v_streak := v_streak + 1;
    end loop;

    -- Check if streak has expired (gap between last period and current period)
    if public.next_campaign_period_start(v_periods[1], v_campaign.streak_cadence) < current_date then
      v_streak := 0;
    end if;

    update public.campaigns c
    set
      streak_count = v_streak,
      streak_last_period_start = case when v_streak > 0 then v_periods[1] else null end
    where c.id = v_campaign.id;
  end loop;
end $$;

comment on function public.apply_campaign_streak_for_date(uuid, date) is
  'Corrected version: same-period=no-op, gap>1=reset to 0/NULL, adds session_notes+entity_tags triggers';
