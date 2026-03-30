-- Allow the GM of a campaign to delete sessions in that campaign.
create policy "GMs can delete sessions"
  on public.sessions
  for delete
  using (
    exists (
      select 1
      from public.campaigns c
      where c.id = sessions.campaign_id
        and c.created_by = auth.uid()
    )
  );
