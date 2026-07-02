export function computeSessionActivities(activityLogs, tags, campaignMembers) {
  const list = []

  // Map for O(1) lookups instead of .find() inside loops
  const memberMap = new Map()
  if (campaignMembers) {
    campaignMembers.forEach(m => memberMap.set(m.user_id, m.display_name))
  }

  // Tag activities (Legacy support + Immediate UI update for non-logged items)
  // We filter out any tags that ALREADY have a create_entity log to avoid duplicates
  if (tags) {
    tags.forEach(tag => {
      // Check if we have a log for this tag creation already
      const hasLog = activityLogs?.some(log =>
        log.action_type === 'create_entity' &&
        log.details?.label === tag.label &&
        // Match loosely on timestamp (within 10 seconds)
        (Math.abs(new Date(log.created_at) - new Date(tag.created_at)) < 10000)
      )

      if (!hasLog) {
        let creatorName = 'Member'
        const creatorId = tag.created_by || tag.user_id
        if (creatorId && memberMap.has(creatorId)) {
          creatorName = memberMap.get(creatorId)
        }

        list.push({
          user: creatorName,
          action: `added ${tag.tag_type === 'item' ? 'inventory' : tag.tag_type}: ${tag.label}`,
          timestamp: tag.created_at
        })
      }
    })
  }

  // Document Edit Activities from Log
  if (activityLogs) {
    activityLogs.forEach(log => {
      let userName = 'Member'
      if (log.user_id && memberMap.has(log.user_id)) {
        userName = memberMap.get(log.user_id)
      }

      if (log.action_type === 'edit_document') {
        // Get session name from details fallback
        const sessionName = log.details?.session_name || 'a session'
        list.push({
          user: userName,
          action: `made changes to ${sessionName}`,
          timestamp: log.created_at
        })
      } else if (log.action_type === 'delete_entity') {
        // Map DB types to friendly names
        let typeLabel = log.details?.type || 'entity'
        if (typeLabel === 'item') typeLabel = 'inventory item'

        list.push({
          user: userName,
          action: `removed ${typeLabel}: ${log.details?.label || 'Unknown'}`,
          timestamp: log.created_at
        })
      } else if (log.action_type === 'create_entity') {
        // Also support explicit create_entity logs if we start using them
        let typeLabel = log.details?.type || 'entity'
        if (typeLabel === 'item') typeLabel = 'inventory item'

        list.push({
          user: userName,
          action: `added ${typeLabel}: ${log.details?.label || 'Unknown'}`,
          timestamp: log.created_at
        })
      } else if (log.action_type === 'join_campaign') {
        list.push({
          user: userName,
          action: 'joined the campaign',
          timestamp: log.created_at
        })
      } else if (log.action_type === 'leave_campaign') {
        list.push({
          user: userName,
          action: 'left the campaign',
          timestamp: log.created_at
        })
      }
    })
  }

  // Member joined activities
  if (campaignMembers) {
    campaignMembers.forEach(member => {
      // created_at in campaign_members usually means join time
      if (member.created_at || member.joined_at) {
        list.push({
          user: member.display_name,
          action: 'joined the campaign',
          timestamp: member.created_at || member.joined_at
        })
      }
    })
  }

  // Filter out duplicates from the combined list based on unique action+timestamp signature
  const seen = new Set()
  const finalList = list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .filter(item => {
      const signature = `${item.action}-${item.timestamp}`
      if (seen.has(signature)) return false
      seen.add(signature)
      return true
    })

  return finalList
}
