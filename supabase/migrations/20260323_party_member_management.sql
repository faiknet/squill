-- Drop the old policy if it exists, then create the corrected one
drop policy if exists "GMs can remove campaign members" on public.campaign_members;

create policy "GMs can remove campaign members"
  on public.campaign_members
  for delete
  using (
    campaign_id in (
      select id from public.campaigns where created_by = auth.uid()
    )
  );

-- Allow GMs to update campaign created_by (transfer GM status)
drop policy if exists "GMs can transfer GM status" on public.campaigns;

create policy "GMs can transfer GM status"
  on public.campaigns
  for update
  using (
    created_by = auth.uid()
  )
  with check (
    true
  );
