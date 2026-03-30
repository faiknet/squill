-- Fix ambiguous column reference in join_campaign_by_invite.
-- Use explicit output assignment and conflict target by constraint name.

create or replace function public.join_campaign_by_invite(p_invite_code uuid)
returns table (
  campaign_id uuid,
  campaign_name text,
  already_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_campaign_id uuid;
  v_campaign_name text;
  v_already_member boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.id, c.name
    into v_campaign_id, v_campaign_name
  from public.campaigns c
  where c.invite_code = p_invite_code
  limit 1;

  if v_campaign_id is null then
    raise exception 'Campaign not found';
  end if;

  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = v_campaign_id
      and cm.user_id = v_user_id
  )
  into v_already_member;

  if not v_already_member then
    insert into public.campaign_members (campaign_id, user_id)
    values (v_campaign_id, v_user_id)
    on conflict on constraint campaign_members_pkey do nothing;
  end if;

  campaign_id := v_campaign_id;
  campaign_name := v_campaign_name;
  already_member := v_already_member;
  return next;
end;
$$;

revoke all on function public.join_campaign_by_invite(uuid) from public;
grant execute on function public.join_campaign_by_invite(uuid) to authenticated;
