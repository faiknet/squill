-- Reliable invite join path callable from client when edge function is unavailable.

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
  v_first_session_id uuid;
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

  if exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = v_campaign_id
      and cm.user_id = v_user_id
  ) then
    return query select v_campaign_id, v_campaign_name, true;
    return;
  end if;

  insert into public.campaign_members (campaign_id, user_id)
  values (v_campaign_id, v_user_id)
  on conflict (campaign_id, user_id) do nothing;

  -- Log join activity to the first session of the campaign
  select s.id into v_first_session_id
  from public.sessions s
  where s.campaign_id = v_campaign_id
  order by s.created_at asc
  limit 1;

  if v_first_session_id is not null then
    insert into public.session_activity_logs (session_id, user_id, action_type, details)
    values (v_first_session_id, v_user_id, 'join_campaign', '{}'::jsonb);
  end if;

  return query select v_campaign_id, v_campaign_name, false;
end;
$$;

revoke all on function public.join_campaign_by_invite(uuid) from public;
grant execute on function public.join_campaign_by_invite(uuid) to authenticated;
