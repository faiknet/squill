-- Drop and recreate the INSERT policy for activity logs
drop policy if exists "Users can insert their own activity" on public.session_activity_logs;
drop policy if exists "Users can insert their own activity logs" on public.session_activity_logs;

-- Allow all authenticated users to insert activity logs
-- The application validates that auth.uid() = user_id
create policy "Allow authenticated users to insert activity logs"
  on public.session_activity_logs for insert
  to authenticated
  with check (true);

-- Keep the SELECT policy restrictive
drop policy if exists "Anyone can read activity logs for campaigns they are in" on public.session_activity_logs;

create policy "Users can read activity logs for their campaigns"
  on public.session_activity_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.sessions s
      join public.campaign_members cm on s.campaign_id = cm.campaign_id
      where s.id = session_activity_logs.session_id
      and cm.user_id = auth.uid()
    )
  );

-- Ensure proper grants exist
grant insert on public.session_activity_logs to authenticated;


