-- Fix get_session_page_data: campaign_members uses joined_at, not created_at
create or replace function public.get_session_page_data(
  p_session_id uuid,
  p_campaign_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
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
          from public.campaign_members cm
          where cm.campaign_id = c.id
            and cm.user_id = auth.uid()
        )
      )
  ) then
    raise exception 'Campaign not found';
  end if;

  if not exists (
    select 1
    from public.sessions s
    where s.id = p_session_id
      and s.campaign_id = p_campaign_id
  ) then
    raise exception 'Session not found';
  end if;

  with session_row as (
    select s.id, s.name, s.campaign_id
    from public.sessions s
    where s.id = p_session_id
  ),
  note_row as (
    select sn.content_md
    from public.session_notes sn
    where sn.session_id = p_session_id
    limit 1
  ),
  tags_rows as (
    select
      et.*,
      jsonb_build_object('name', s.name) as sessions
    from public.entity_tags et
    left join public.sessions s on s.id = et.session_id
    where et.campaign_id = p_campaign_id
    order by et.created_at desc
  ),
  members_rows as (
    select
      cm.user_id,
      coalesce(nullif(trim(p.display_name), ''), 'Adventurer') as display_name,
      up.editor_color as color,
      cm.joined_at as joined_at
    from public.campaign_members cm
    left join public.profiles p on p.id = cm.user_id
    left join public.user_preferences up on up.user_id = cm.user_id
    where cm.campaign_id = p_campaign_id
    order by lower(coalesce(nullif(trim(p.display_name), ''), 'Adventurer')), cm.user_id::text
  ),
  campaign_row as (
    select c.invite_code
    from public.campaigns c
    where c.id = p_campaign_id
  ),
  session_notes_rows as (
    select s.id, s.name, s.slug, s.session_date, s.created_at
    from public.sessions s
    where s.campaign_id = p_campaign_id
  ),
  activity_rows as (
    select sal.*
    from public.session_activity_logs sal
    inner join public.sessions s on s.id = sal.session_id
    where s.campaign_id = p_campaign_id
    order by sal.created_at desc
    limit 100
  )
  select jsonb_build_object(
    'session', (select to_jsonb(sr) from session_row sr),
    'noteContent', coalesce((select nr.content_md from note_row nr), '<p></p>'),
    'tags', coalesce((select jsonb_agg(to_jsonb(tr)) from tags_rows tr), '[]'::jsonb),
    'campaignMembers', coalesce((select jsonb_agg(to_jsonb(mr)) from members_rows mr), '[]'::jsonb),
    'inviteCode', (select cr.invite_code from campaign_row cr),
    'sessionNotes', coalesce((select jsonb_agg(to_jsonb(sn)) from session_notes_rows sn), '[]'::jsonb),
    'activityLogs', coalesce((select jsonb_agg(to_jsonb(ar)) from activity_rows ar), '[]'::jsonb)
  )
  into v_payload;

  return v_payload;
end;
$$;

revoke all on function public.get_session_page_data(uuid, uuid) from public;
grant execute on function public.get_session_page_data(uuid, uuid) to authenticated;
