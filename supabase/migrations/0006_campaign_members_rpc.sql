-- Return full campaign member list (names) for a specific campaign visible to the user.

create or replace function public.get_campaign_members(p_campaign_id uuid)
returns table (
  user_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.campaigns c
    where c.id = p_campaign_id
      and (
        c.created_by = auth.uid()
        or exists (
          select 1
          from public.campaign_members me
          where me.campaign_id = c.id
            and me.user_id = auth.uid()
        )
      )
  ) then
    raise exception 'Campaign not found';
  end if;

  return query
  select
    cm.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Adventurer') as display_name
  from public.campaign_members cm
  left join public.profiles p on p.id = cm.user_id
  where cm.campaign_id = p_campaign_id
  order by lower(coalesce(nullif(trim(p.display_name), ''), 'Adventurer')), cm.user_id::text;
end;
$$;

revoke all on function public.get_campaign_members(uuid) from public;
grant execute on function public.get_campaign_members(uuid) to authenticated;
