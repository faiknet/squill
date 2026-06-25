-- Fix streak logic to properly handle expired periods
-- When a new period starts that is more than one period ago, the streak should be 0, not 1

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
  v_expected_next_period_start date;
  v_gap_days integer;
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
    -- Same period, increment streak
    v_new_streak_count := (
      select c.streak_count + 1
      from public.campaigns c
      where c.id = p_campaign_id
    );
  elsif v_new_period_start = public.next_campaign_period_start(v_last_period_start, v_cadence) then
    -- Consecutive period, increment streak
    v_new_streak_count := (
      select c.streak_count + 1
      from public.campaigns c
      where c.id = p_campaign_id
    );
  elsif v_new_period_start > v_last_period_start then
    -- Check if the period has expired (more than one period ago)
    v_expected_next_period_start := public.next_campaign_period_start(v_last_period_start, v_cadence);
    v_gap_days := (
      select extract(epoch from v_new_period_start - v_expected_next_period_start) / 86400
    );
    
    -- If gap is more than 1 period, streak should be 0
    case v_cadence
      when 'weekly' then
        if v_gap_days > 7 then
          v_new_streak_count := 0;
        else
          v_new_streak_count := 1;
        end if;
      when 'biweekly' then
        if v_gap_days > 14 then
          v_new_streak_count := 0;
        else
          v_new_streak_count := 1;
        end if;
      when 'monthly' then
        if v_gap_days > 30 then
          v_new_streak_count := 0;
        else
          v_new_streak_count := 1;
        end if;
      else
        v_new_streak_count := 1;
    end case;
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

-- Drop and recreate the trigger
drop trigger if exists trg_apply_campaign_streak_on_session_insert on public.sessions;
create trigger trg_apply_campaign_streak_on_session_insert
  after insert on public.sessions
  for each row
  execute function public.apply_campaign_streak_on_session_insert();

-- Backfill streaks from existing non-archived sessions
-- This will reset all stale streaks to 0 if they've expired
do $$
declare
  v_campaign record;
  v_periods date[];
  v_streak integer;
  v_last_period_start date;
  v_expected_previous_period_start date;
  v_num_periods integer;
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
    ) p
    limit 100;

    -- If no periods, skip
    if v_periods is null or array_length(v_periods, 1) = 0 then
      continue;
    end if;

    v_streak := 1;
    v_last_period_start := v_periods[1];  -- Start with the most recent period
    v_num_periods := coalesce(array_length(v_periods, 1), 0);

    -- Iterate backwards through previous periods
    for i in 2..v_num_periods loop
      v_expected_previous_period_start := public.previous_campaign_period_start(v_last_period_start, v_campaign.streak_cadence);
      
      -- Check if the current period is the expected previous period
      if v_periods[i] = v_expected_previous_period_start then
        v_streak := v_streak + 1;
        v_last_period_start := v_periods[i];
      else
        -- Gap detected, streak is 0
        v_streak := 0;
        exit;
      end if;
    end loop;

    -- Only update if streak changed
    if v_streak <= 1 then
      perform set_config('app.allow_streak_write', '1', true);
      update public.campaigns c
      set
        streak_count = v_streak,
        streak_last_period_start = v_periods[1]
      where c.id = v_campaign.id
        and (c.streak_count != v_streak or c.streak_last_period_start != v_periods[1]);
    end if;
  end loop;
end $$;

-- Comment out the old function for reference
comment on function public.apply_campaign_streak_for_date(uuid, date) is 'Fixed version that properly handles expired periods';
