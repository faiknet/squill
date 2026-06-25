-- Add streak tracking on session updates
-- When a user edits a session, it should also check/calculate the campaign streak

drop trigger if exists trg_apply_campaign_streak_on_session_update on public.sessions;

create trigger trg_apply_campaign_streak_on_session_update
  after update on public.sessions
  for each row
  when (old.* IS DISTINCT FROM new.*)  -- Only trigger on actual field changes
  execute function public.apply_campaign_streak_on_session_insert();
