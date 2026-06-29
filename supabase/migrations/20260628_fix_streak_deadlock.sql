-- Fix "deadlock detected" error when creating sessions.
-- Root cause: apply_campaign_streak_for_date used SELECT ... FOR UPDATE which
-- held an explicit row lock on campaigns across multiple statements. The second
-- trigger (update_campaign_on_session_change) also updates campaigns, and
-- concurrent operations (e.g. update_campaign_as_gm_with_streak) could lock
-- campaigns and then try to access sessions, creating a circular lock dependency.
--
-- Fix: Replace read-then-write with a single atomic UPDATE that computes
-- streak values inline. PostgreSQL holds the row lock only for the duration
-- of the UPDATE statement, eliminating the deadlock window entirely.

create or replace function public.apply_campaign_streak_for_date(
  p_campaign_id uuid,
  p_activity_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.allow_streak_write', '1', true);

  update public.campaigns c
  set
    streak_count = greatest(0, coalesce(
      case
        when c.streak_last_period_start is null then 1
        when cal.new_period_start = public.next_campaign_period_start(c.streak_last_period_start, c.streak_cadence) then c.streak_count + 1
        when cal.new_period_start > c.streak_last_period_start then 1
      end,
      0
    )),
    streak_last_period_start = cal.new_period_start
  from (
    select public.campaign_period_start(coalesce(p_activity_date, current_date), c.streak_cadence) as new_period_start
    from public.campaigns c
    where c.id = p_campaign_id
  ) cal
  where c.id = p_campaign_id
    and (
      c.streak_last_period_start is null
      or cal.new_period_start > c.streak_last_period_start
    );
end;
$$;
