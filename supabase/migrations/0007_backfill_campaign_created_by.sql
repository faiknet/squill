-- Backfill missing campaign creator so GM features work for legacy rows.
-- Also tighten insert policy to require explicit creator ownership.

update public.campaigns c
set created_by = seeded.user_id
from (
  select distinct on (cm.campaign_id)
    cm.campaign_id,
    cm.user_id
  from public.campaign_members cm
  order by cm.campaign_id, cm.joined_at asc, cm.user_id asc
) seeded
where c.id = seeded.campaign_id
  and c.created_by is null;

drop policy if exists "campaigns create own" on public.campaigns;
create policy "campaigns create own"
  on public.campaigns for insert
  to authenticated
  with check (created_by = auth.uid());
