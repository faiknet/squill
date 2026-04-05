-- Fix cadence math semantics:
-- - biweekly = 14-day cadence windows
-- - monthly = 4-week (28-day) cadence windows
-- - when cadence changes, rebase streak to current-window activity (0 or 1), no inflation

create or replace function public.campaign_cadence_days(
  p_cadence text
)
returns integer
language plpgsql
immutable
as $$
begin
  if p_cadence = 'biweekly' then
    return 14;
  end if;

  if p_cadence = 'monthly' then
    return 28;
  end if;

  return 7;
end;
$$;

create or replace function public.campaign_period_start(
  p_date date,
  p_cadence text
)
returns date
language plpgsql
immutable
as $$
declare
  v_epoch_monday constant date := date '1970-01-05';
  v_period_days integer := public.campaign_cadence_days(coalesce(p_cadence, 'weekly'));
begin
  return v_epoch_monday + (((p_date - v_epoch_monday) / v_period_days) * v_period_days);
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
  return p_period_start + public.campaign_cadence_days(coalesce(p_cadence, 'weekly'));
end;
$$;

create or replace function public.update_campaign_as_gm_with_streak(
  p_campaign_id uuid,
  p_name text,
  p_description text default null,
  p_streak_cadence text default null
)
returns table (
  id uuid,
  name text,
  description text,
  invite_code uuid,
  created_by uuid,
  streak_count integer,
  streak_cadence text,
  streak_last_period_start date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_created_by uuid;
  v_seed_user uuid;
  v_existing_cadence text;
  v_new_cadence text;
  v_existing_streak_count integer;
  v_latest_activity_date date;
  v_new_streak_count integer;
  v_new_period_start date;
  v_window_days integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Campaign name is required';
  end if;

  select c.created_by, c.streak_cadence, c.streak_count
    into v_created_by, v_existing_cadence, v_existing_streak_count
  from public.campaigns c
  where c.id = p_campaign_id
  limit 1;

  if not found then
    raise exception 'Campaign not found';
  end if;

  if v_created_by is null then
    select cm.user_id
      into v_seed_user
    from public.campaign_members cm
    where cm.campaign_id = p_campaign_id
    order by cm.joined_at asc, cm.user_id asc
    limit 1;

    if v_seed_user is null or v_seed_user <> v_user_id then
      raise exception 'Only the GM can edit this campaign.';
    end if;

    update public.campaigns c
    set created_by = v_user_id
    where c.id = p_campaign_id
      and c.created_by is null;

    v_created_by := v_user_id;
  end if;

  if v_created_by <> v_user_id then
    raise exception 'Only the GM can edit this campaign.';
  end if;

  v_new_cadence := lower(trim(coalesce(nullif(p_streak_cadence, ''), v_existing_cadence, 'weekly')));
  if v_new_cadence not in ('weekly', 'biweekly', 'monthly') then
    raise exception 'Invalid streak cadence';
  end if;

  v_new_streak_count := coalesce(v_existing_streak_count, 0);
  v_new_period_start := null;

  if v_new_cadence is distinct from v_existing_cadence then
    select max(coalesce(s.session_date, (s.created_at at time zone 'utc')::date))
      into v_latest_activity_date
    from public.sessions s
    where s.campaign_id = p_campaign_id
      and not s.archived;

    v_window_days := public.campaign_cadence_days(v_new_cadence);

    if v_latest_activity_date is null or v_latest_activity_date < (current_date - (v_window_days - 1)) then
      v_new_streak_count := 0;
      v_new_period_start := null;
    else
      v_new_streak_count := 1;
      v_new_period_start := public.campaign_period_start(v_latest_activity_date, v_new_cadence);
    end if;
  end if;

  perform set_config('app.allow_streak_write', '1', true);

  update public.campaigns c
  set
    name = trim(p_name),
    description = nullif(trim(coalesce(p_description, '')), ''),
    streak_cadence = v_new_cadence,
    streak_count = case when v_new_cadence is distinct from v_existing_cadence then v_new_streak_count else c.streak_count end,
    streak_last_period_start = case when v_new_cadence is distinct from v_existing_cadence then v_new_period_start else c.streak_last_period_start end
  where c.id = p_campaign_id;

  return query
  select
    c.id,
    c.name,
    c.description,
    c.invite_code,
    c.created_by,
    c.streak_count,
    c.streak_cadence,
    c.streak_last_period_start
  from public.campaigns c
  where c.id = p_campaign_id;
end;
$$;

revoke all on function public.campaign_cadence_days(text) from public;
grant execute on function public.campaign_cadence_days(text) to authenticated;

revoke all on function public.update_campaign_as_gm_with_streak(uuid, text, text, text) from public;
grant execute on function public.update_campaign_as_gm_with_streak(uuid, text, text, text) to authenticated;

