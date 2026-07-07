-- Add custom labeling columns to campaigns table
alter table public.campaigns
add column if not exists label_campaign text not null default 'Campaign',
add column if not exists label_session text not null default 'Session',
add column if not exists label_member text not null default 'Players',
add column if not exists label_gm text not null default 'GM';

-- Drop the old version of the function first so we can modify the return table structure and parameters
drop function if exists public.update_campaign_as_gm_with_streak(uuid, text, text, text);

create or replace function public.update_campaign_as_gm_with_streak(
  p_campaign_id uuid,
  p_name text,
  p_description text default null,
  p_streak_cadence text default null,
  p_label_campaign text default null,
  p_label_session text default null,
  p_label_member text default null,
  p_label_gm text default null
)
returns table (
  id uuid,
  name text,
  description text,
  invite_code uuid,
  created_by uuid,
  streak_count integer,
  streak_cadence text,
  streak_last_period_start date,
  label_campaign text,
  label_session text,
  label_member text,
  label_gm text
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
      -- Streak automatic conversion math: convert the streak duration to new cadence, rounding down.
      declare
        v_existing_days integer;
      begin
        v_existing_days := public.campaign_cadence_days(coalesce(v_existing_cadence, 'weekly'));
        v_new_streak_count := floor((v_new_streak_count * v_existing_days)::numeric / v_window_days::numeric);
        -- Ensure that if a streak is active, it starts at least at 1
        if v_new_streak_count < 1 then
          v_new_streak_count := 1;
        end if;
      end;
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
    streak_last_period_start = case when v_new_cadence is distinct from v_existing_cadence then v_new_period_start else c.streak_last_period_start end,
    label_campaign = coalesce(nullif(trim(p_label_campaign), ''), c.label_campaign),
    label_session = coalesce(nullif(trim(p_label_session), ''), c.label_session),
    label_member = coalesce(nullif(trim(p_label_member), ''), c.label_member),
    label_gm = coalesce(nullif(trim(p_label_gm), ''), c.label_gm)
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
    c.streak_last_period_start,
    c.label_campaign,
    c.label_session,
    c.label_member,
    c.label_gm
  from public.campaigns c
  where c.id = p_campaign_id;
end;
$$;

revoke all on function public.update_campaign_as_gm_with_streak(uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.update_campaign_as_gm_with_streak(uuid, text, text, text, text, text, text, text) to authenticated;
