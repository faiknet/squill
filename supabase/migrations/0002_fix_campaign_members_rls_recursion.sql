-- Fix infinite recursion in campaign_members RLS policies.
-- Root cause: self-referential SELECT policy queried campaign_members again.

alter table public.campaign_members enable row level security;

drop policy if exists "campaign_members read own campaign" on public.campaign_members;
drop policy if exists "campaign_members join self" on public.campaign_members;

-- Read only your own membership rows (non-recursive).
create policy "campaign_members read own membership"
  on public.campaign_members for select
  to authenticated
  using (user_id = auth.uid());

-- Allow users to insert their own membership row (used by invite join flow).
create policy "campaign_members insert self"
  on public.campaign_members for insert
  to authenticated
  with check (user_id = auth.uid());

-- Optional: allow users to leave campaigns by deleting their own membership.
drop policy if exists "campaign_members delete self" on public.campaign_members;
create policy "campaign_members delete self"
  on public.campaign_members for delete
  to authenticated
  using (user_id = auth.uid());
