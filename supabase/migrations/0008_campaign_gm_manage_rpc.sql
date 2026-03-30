-- GM-managed campaign updates with legacy owner recovery.

create or replace function public.update_campaign_as_gm(
  p_campaign_id uuid,
  p_name text,
  p_description text default null
)
returns table (
  id uuid,
  name text,
  description text,
  invite_code uuid,
  created_by uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_created_by uuid;
  v_seed_user uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Campaign name is required';
  end if;

  select c.created_by
    into v_created_by
  from public.campaigns c
  where c.id = p_campaign_id
  limit 1;

  if not found then
    raise exception 'Campaign not found';
  end if;

  if v_created_by is null then
    select cm.user_id
      into v_seed_user
    from public.campaign_members cm
    where cm.campaign_id = p_campaign_id
    order by cm.joined_at asc, cm.user_id asc
    limit 1;

    if v_seed_user is null or v_seed_user <> v_user_id then
      raise exception 'Only the GM can edit this campaign.';
    end if;

    update public.campaigns c
    set created_by = v_user_id
    where c.id = p_campaign_id
      and c.created_by is null;

    v_created_by := v_user_id;
  end if;

  if v_created_by <> v_user_id then
    raise exception 'Only the GM can edit this campaign.';
  end if;

  return query
  update public.campaigns c
  set
    name = trim(p_name),
    description = nullif(trim(coalesce(p_description, '')), '')
  where c.id = p_campaign_id
  returning c.id, c.name, c.description, c.invite_code, c.created_by;
end;
$$;

revoke all on function public.update_campaign_as_gm(uuid, text, text) from public;
grant execute on function public.update_campaign_as_gm(uuid, text, text) to authenticated;
