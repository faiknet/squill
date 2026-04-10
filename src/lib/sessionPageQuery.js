export async function fetchSessionPageData(client, campaignId, sessionId) {
  const { data: sessionPageData, error: sessionPageError } = await client.rpc('get_session_page_data', {
    p_session_id: sessionId,
    p_campaign_id: campaignId,
  })

  if (!sessionPageError && sessionPageData) {
    return {
      session: sessionPageData.session || null,
      noteContent: sessionPageData.noteContent || '<p></p>',
      tags: sessionPageData.tags || [],
      campaignMembers: sessionPageData.campaignMembers || [],
      inviteCode: sessionPageData.inviteCode || null,
      activityLogs: sessionPageData.activityLogs || [],
      sessionNotes: sessionPageData.sessionNotes || [],
    }
  }

  const errorMessage = String(sessionPageError?.message || '')
  const missingRpc =
    errorMessage.includes('Could not find the function public.get_session_page_data') ||
    errorMessage.includes('function public.get_session_page_data')
  if (sessionPageError && !missingRpc) {
    throw sessionPageError
  }

  const [sessionRes, noteRes, tagsRes, membersRes, campaignRes, allSessionsRes] = await Promise.all([
    client.from('sessions').select('id, name, campaign_id').eq('id', sessionId).single(),
    client.from('session_notes').select('content_md, updated_at').eq('session_id', sessionId).maybeSingle(),
    client.from('entity_tags').select('*, sessions(name)').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
    client.rpc('get_campaign_members', { p_campaign_id: campaignId }),
    client.from('campaigns').select('invite_code').eq('id', campaignId).single(),
    client.from('sessions').select('id, name, slug, session_date, created_at').eq('campaign_id', campaignId),
  ])

  if (sessionRes.error) throw sessionRes.error

  const allSessionsList = allSessionsRes.data || []
  let activityData = []
  if (allSessionsList.length > 0) {
    const activityResult = await client
      .from('session_activity_logs')
      .select('*')
      .in('session_id', allSessionsList.map((item) => item.id))
      .order('created_at', { ascending: false })
      .limit(100)
    activityData = activityResult.data || []
  }

  let members = []
  if (membersRes.error) {
    members = []
  } else {
    members = membersRes.data || []
    const memberIds = members.map((member) => member.user_id)
    if (memberIds.length > 0) {
      try {
        const colorRes = await client.rpc('get_user_colors', { user_ids: memberIds })
        if (!colorRes.error) {
          const colorMap = new Map()
          colorRes.data?.forEach((item) => {
            colorMap.set(item.user_id, item.editor_color)
          })
          members = members.map((member) => ({
            ...member,
            color: colorMap.get(member.user_id),
          }))
        }
      } catch {
        // no-op: keep members without color
      }
    }
  }

  return {
    session: sessionRes.data,
    noteContent: noteRes.data?.content_md || '<p></p>',
    tags: tagsRes.data || [],
    campaignMembers: members,
    inviteCode: campaignRes.data?.invite_code || null,
    activityLogs: activityData,
    sessionNotes: allSessionsList,
  }
}
