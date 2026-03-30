-- Return full party sizes for campaigns visible to the authenticated user.
-- SECURITY DEFINER is required because campaign_members SELECT policy is per-user.

create or replace function public.get_campaign_party_sizes()
returns table (
  campaign_id uuid,
  party_size bigint
)
language sql
security definer
set search_path = public
as $$
  select
    c.id as campaign_id,
    count(cm.user_id)::bigint as party_size
  from public.campaigns c
  left join public.campaign_members cm
    on cm.campaign_id = c.id
  where c.created_by = auth.uid()
     or exists (
       select 1
       from public.campaign_members me
       where me.campaign_id = c.id
         and me.user_id = auth.uid()
     )
  group by c.id;
$$;

revoke all on function public.get_campaign_party_sizes() from public;
grant execute on function public.get_campaign_party_sizes() to authenticated;
