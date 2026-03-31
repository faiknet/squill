-- FIX for campaign pinning RLS policy
-- The original policy prevented users from pinning campaigns they created
-- because it checked if the user was a member (not just the creator).
-- 
-- This simplified policy only checks that the user_id matches auth.uid(),
-- which is sufficient since the campaigns table RLS policy already ensures
-- users can only see campaigns they have access to.

drop policy if exists "campaign_pins upsert own membership" on public.campaign_pins;
create policy "campaign_pins upsert own membership"
  on public.campaign_pins for insert
  to authenticated
  with check (user_id = auth.uid());
