-- Allow GMs to update campaign streak cadence and keep streak values consistent.

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

  update public.campaigns c
  set
    streak_count = v_streak,
    streak_last_period_start = v_periods[1]
  where c.id = p_campaign_id;
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Campaign name is required';
  end if;

  select c.created_by, c.streak_cadence
    into v_created_by, v_existing_cadence
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

  perform set_config('app.allow_streak_write', '1', true);

  update public.campaigns c
  set
    name = trim(p_name),
    description = nullif(trim(coalesce(p_description, '')), ''),
    streak_cadence = v_new_cadence
  where c.id = p_campaign_id;

  if v_new_cadence is distinct from v_existing_cadence then
    perform public.recalculate_campaign_streak(p_campaign_id);
  end if;

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

revoke all on function public.recalculate_campaign_streak(uuid) from public;

revoke all on function public.update_campaign_as_gm_with_streak(uuid, text, text, text) from public;
grant execute on function public.update_campaign_as_gm_with_streak(uuid, text, text, text) to authenticated;

