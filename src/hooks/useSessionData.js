import { useState, useEffect, useCallback, useRef } from 'react'
import { requireSupabase } from '../lib/supabase'
import { useAuth } from './useSupabaseAuth'
import {
  validateUpdateNote,
  validateCreateEntityTag,
  validateUpdateEntityTag,
  validateSessionId,
  validateCampaignId,
  validateTagId,
  ValidationError,
} from '../lib/validation'
import {
  GUEST_CAMPAIGN_ID,
  getGuestSession,
  getGuestSessionsForCampaign,
  getGuestSessionNote,
  getGuestEntityTags,
  getGuestCampaignMembers,
  getGuestActivityLogs,
} from '../lib/guestData'

// Storage key for guest session note (persists within browser session)
const GUEST_NOTE_STORAGE_KEY = 'squill_guest_session_note'
const GUEST_TAGS_STORAGE_KEY = 'squill_guest_session_tags'
const GUEST_EDIT_ACTIVITY_THROTTLE_MS = 2 * 60 * 60 * 1000
const GUEST_NOTE_SCHEMA_VERSION_KEY = 'squill_guest_session_note_schema_version'
const GUEST_NOTE_SCHEMA_VERSION = '3'

export function useSessionData(sessionId, campaignId) {
  const { authState } = useAuth()
  const { isGuest } = authState
  const [session, setSession] = useState(null)
  const [noteContent, setNoteContent] = useState('<p></p>')
  const [tags, setTags] = useState([])
  const [campaignMembers, setCampaignMembers] = useState([])
  const [inviteCode, setInviteCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activityLogs, setActivityLogs] = useState([])
  const [sessionNotes, setSessionNotes] = useState([])
  const guestTagIdCounter = useRef(100)

  // Load guest session data
  const loadGuestSession = useCallback(() => {
    const userId = authState.user?.id
    if (!userId || !sessionId || !campaignId) return

    const guestSession = getGuestSessionsForCampaign(campaignId).find((item) => item.id === sessionId)
    if (!guestSession) {
      setError('Guest session not found')
      setLoading(false)
      return
    }
    
    // Try to load saved note from sessionStorage, or use default
    let savedNote = null
    let savedSchemaVersion = null
    try {
      savedNote = sessionStorage.getItem(GUEST_NOTE_STORAGE_KEY)
      savedSchemaVersion = sessionStorage.getItem(GUEST_NOTE_SCHEMA_VERSION_KEY)
    } catch {
      // Ignore storage errors
    }
    let noteContentValue = savedNote || getGuestSessionNote()

    // Migrate older guest notes that predate mention-marked defaults
    if (savedNote && savedSchemaVersion !== GUEST_NOTE_SCHEMA_VERSION) {
      noteContentValue = getGuestSessionNote()
      try {
        sessionStorage.setItem(GUEST_NOTE_STORAGE_KEY, noteContentValue)
        sessionStorage.setItem(GUEST_NOTE_SCHEMA_VERSION_KEY, GUEST_NOTE_SCHEMA_VERSION)
      } catch {
        // Ignore storage errors
      }
    } else if (!savedNote) {
      try {
        sessionStorage.setItem(GUEST_NOTE_SCHEMA_VERSION_KEY, GUEST_NOTE_SCHEMA_VERSION)
      } catch {
        // Ignore storage errors
      }
    }

    // Try to load saved tags from sessionStorage, or use default
    let savedTags = null
    try {
      const tagsJson = sessionStorage.getItem(`${GUEST_TAGS_STORAGE_KEY}:${sessionId}`)
      if (tagsJson) savedTags = JSON.parse(tagsJson)
    } catch {
      // Ignore storage errors
    }
    const tagsValue = savedTags || getGuestEntityTags(campaignId, sessionId)
    const activityLogsValue = getGuestActivityLogs(sessionId, userId)

    setSession({ id: guestSession.id, name: guestSession.name, campaign_id: guestSession.campaign_id })
    setNoteContent(noteContentValue)
    setTags(tagsValue)
    setInviteCode('DEMO1234')
    setCampaignMembers(getGuestCampaignMembers(userId))
    setActivityLogs(activityLogsValue)
    setSessionNotes(
      getGuestSessionsForCampaign(campaignId).map(item => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        session_date: item.session_date,
        created_at: item.created_at,
      }))
    )
    setLoading(false)
  }, [authState.user?.id, sessionId, campaignId])

  const loadSession = useCallback(async () => {
    // Handle guest users with local demo data
    if (isGuest) {
      loadGuestSession()
      return
    }

    try {
      const client = requireSupabase()
      
      const [sessionRes, noteRes, tagsRes, membersRes, campaignRes, allSessionsRes] = await Promise.all([
        client.from('sessions').select('id, name, campaign_id').eq('id', sessionId).single(),
        client.from('session_notes').select('content_md, updated_at').eq('session_id', sessionId).maybeSingle(),
        client.from('entity_tags').select('*, sessions(name)').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
        client.rpc('get_campaign_members', { p_campaign_id: campaignId }),
        client.from('campaigns').select('invite_code').eq('id', campaignId).single(),
        // Get all sessions in this campaign
        client.from('sessions').select('id, name, slug, session_date, created_at').eq('campaign_id', campaignId),
      ])

      if (sessionRes.error) throw sessionRes.error
      
      // Get all session notes for mention dropdown
      const allSessionsList = allSessionsRes.data || []
      setSessionNotes(allSessionsList)

      // Now fetch activity logs for all sessions in the campaign
      const sessionIds = allSessionsList.map(s => s.id)
      let activityData = []
      if (sessionIds.length > 0) {
        const activityResult = await client
          .from('session_activity_logs')
          .select('*')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })
          .limit(100)
        activityData = activityResult.data || []
      }

      console.log('Activity logs loaded:', activityData)
      
      setSession(sessionRes.data)
      setNoteContent(noteRes.data?.content_md || '<p></p>')
      setTags(tagsRes.data || [])
      setInviteCode(campaignRes.data?.invite_code || null)
      setActivityLogs(activityData)
      
      // Handle members RPC potential error (e.g., if function missing)
      if (membersRes.error) {
        console.warn('Failed to load members', membersRes.error)
        setCampaignMembers([])
      } else {
        // Fetch user colors for all members
        const memberIds = membersRes.data?.map(m => m.user_id) || []
        if (memberIds.length > 0) {
          try {
            const colorRes = await client.rpc('get_user_colors', {
              user_ids: memberIds
            })
            
            if (colorRes.error) {
              console.warn('Failed to load user colors', colorRes.error)
              setCampaignMembers(membersRes.data || [])
            } else {
              const colorMap = new Map()
              colorRes.data?.forEach(item => {
                colorMap.set(item.user_id, item.editor_color)
              })
              
              // Add color to members
              const membersWithColor = membersRes.data.map(member => ({
                ...member,
                color: colorMap.get(member.user_id)
              }))
              setCampaignMembers(membersWithColor)
            }
          } catch (err) {
            console.debug('Error fetching colors:', err.message)
            setCampaignMembers(membersRes.data || [])
          }
        } else {
          setCampaignMembers(membersRes.data || [])
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [sessionId, campaignId, isGuest, loadGuestSession])

  // Poll for activity log changes for ALL sessions in the campaign
  useEffect(() => {
    // Skip polling for guest users
    if (!campaignId || isGuest) return

    const pollActivityLogs = async () => {
      try {
        const client = requireSupabase()
        
        // Get all session IDs in this campaign
        const { data: sessionList } = await client
          .from('sessions')
          .select('id')
          .eq('campaign_id', campaignId)
        
        const sessionIds = sessionList?.map(s => s.id) || []
        
        if (sessionIds.length === 0) return

        // Fetch activity logs for all sessions
        const { data, error } = await client
          .from('session_activity_logs')
          .select('*')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })
          .limit(100)

        if (error) {
          console.error('Error polling activity logs:', error)
        } else {
          console.log('Activity logs polled:', data?.length || 0)
          setActivityLogs(data || [])
        }
      } catch (err) {
        console.error('Poll failed:', err)
      }
    }

    // Poll every 5 seconds
    const interval = setInterval(pollActivityLogs, 5000)
    return () => clearInterval(interval)
  }, [campaignId, isGuest])

  const logActivity = useCallback(async (actionType, detailsOrName) => {
    try {
      const client = requireSupabase()
      const userId = authState.user?.id
      // Allow passing either a string (sessionName) or an object for details
      const details = typeof detailsOrName === 'string' 
        ? { session_name: detailsOrName } 
        : (detailsOrName || {})
        
      console.log('logActivity called:', { actionType, userId, sessionId, details })
      if (!userId) {
        console.warn('No userId, skipping activity log')
        return
      }

      // Check last activity of this type for this user in this session
      const { data: lastActivity, error: checkError } = await client
        .from('session_activity_logs')
        .select('created_at')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('action_type', actionType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (checkError) {
        console.warn('Error checking last activity:', checkError)
      }

      const now = new Date()
      // If found, check if it was less than the throttle time ago
      if (lastActivity) {
        const lastTime = new Date(lastActivity.created_at)
        const diffMinutes = (now - lastTime) / (1000 * 60)
        // Throttle 'edit_document' actions (5 minute throttle), allow others to go through
        if (actionType === 'edit_document' && diffMinutes < 5) {
          console.log('Activity log throttled (less than 5 minutes since last)', actionType)
          return // Skip logging to avoid spam
        }
      }

      console.log('Inserting new activity log...')
      // Insert new activity
      const { data: newActivity, error } = await client
        .from('session_activity_logs')
        .insert({
          session_id: sessionId,
          user_id: userId,
          action_type: actionType,
          details: details
        })
        .select()
        .single()
      
      if (error) {
        console.error('Failed to insert activity log:', error)
      } else if (newActivity) {
        console.log('Activity logged successfully:', actionType, newActivity)
        setActivityLogs(prev => [newActivity, ...prev])
      } else {
        console.warn('No data returned from insert, but no error either')
      }
    } catch (err) {
      console.error('Failed to log activity', err)
    }
  }, [sessionId, authState.user?.id])

  const saveNote = useCallback(async (content) => {
    setSaving(true)
    setError('')

    // For guest users, save to sessionStorage instead
    if (isGuest) {
      try {
        sessionStorage.setItem(GUEST_NOTE_STORAGE_KEY, content)
        setNoteContent(content)

        const now = Date.now()
        let shouldLogEditActivity = true
        const guestEditActivityKey = `squill_guest_last_edit_activity_at:${sessionId || GUEST_SESSION_ID}:${authState.user?.id || 'guest'}`

        try {
          const lastActivityAtRaw = localStorage.getItem(guestEditActivityKey)
          const lastActivityAt = Number(lastActivityAtRaw)
          if (Number.isFinite(lastActivityAt) && now - lastActivityAt < GUEST_EDIT_ACTIVITY_THROTTLE_MS) {
            shouldLogEditActivity = false
          }
        } catch {
          // Ignore storage errors
        }

        if (shouldLogEditActivity) {
          const newActivity = {
            id: `activity-${now}`,
            session_id: sessionId,
            user_id: authState.user?.id,
            action_type: 'edit_document',
            details: {
              session_name: session?.name || 'Session',
            },
            created_at: new Date(now).toISOString(),
          }

          setActivityLogs(prev => [newActivity, ...prev])

          try {
            localStorage.setItem(guestEditActivityKey, String(now))
          } catch {
            // Ignore storage errors
          }
        }
      } catch (err) {
        setError('Failed to save note locally')
      } finally {
        setSaving(false)
      }
      return
    }

    try {
      // Validate content before saving
      const validated = validateUpdateNote({ contentMd: content })
      const validatedSessionId = validateSessionId(sessionId)
      
      const { error } = await requireSupabase().from('session_notes').upsert({
        session_id: validatedSessionId,
        content_md: validated.contentMd,
        liveblocks_id: validatedSessionId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_id' })

      if (error) throw error
      
      console.log('Note saved, calling logActivity...')
      // Log edit activity (debounced/throttled by the logActivity function logic)
      logActivity('edit_document', session?.name)
      
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.getClientMessage())
      } else {
        setError(err.message || 'Failed to save note')
      }
    } finally {
      setSaving(false)
    }
  }, [sessionId, logActivity, session?.name, isGuest])

  const addTag = useCallback(async (type, label) => {
    // For guest users, add tag to local state only
    if (isGuest) {
      const dbType = type === 'inventory' ? 'item' : type
      const newTag = {
        id: `guest-tag-${guestTagIdCounter.current++}`,
        campaign_id: campaignId,
        session_id: sessionId,
        label,
        tag_type: dbType,
        created_by: authState.user?.id,
        created_at: new Date().toISOString(),
        sessions: { name: session?.name || 'Session' },
      }
      setTags(prev => {
        const newTags = [newTag, ...prev]
        try {
          sessionStorage.setItem(`${GUEST_TAGS_STORAGE_KEY}:${sessionId}`, JSON.stringify(newTags))
        } catch {
          // Ignore storage errors
        }
        return newTags
      })
      
      // Add activity log for the tag creation
      const newActivity = {
        id: `activity-${Date.now()}`,
        session_id: sessionId,
        user_id: authState.user?.id,
        action_type: 'create_entity',
        details: {
          label,
          type: dbType,
          session_name: session?.name || 'Session',
        },
        created_at: new Date().toISOString(),
      }
      setActivityLogs(prev => [newActivity, ...prev])
      
      return true
    }

    try {
      // Validate tag data before insertion
      const validated = validateCreateEntityTag({
        name: label,
        tagType: type === 'inventory' ? 'item' : type,
        sessionId: sessionId,
        description: undefined
      })

      // Map frontend types to database types
      let dbType = validated.tagType
      
      const { data, error } = await requireSupabase()
        .from('entity_tags')
        .insert({
          session_id: sessionId,
          campaign_id: campaignId,
          label: validated.name,
          tag_type: dbType,
          created_by: authState.user?.id,
        })
        .select('*, sessions(name)')
        .single()

      if (error) throw error

      // Ensure sessions object is populated if not returned correctly
      if (!data.sessions && session) {
        data.sessions = { name: session.name }
      }

      setTags(prev => [data, ...prev])

      // Optimistically add activity log for immediate feedback
      // This ensures the "Added" state persists even if the tag is immediately deleted
      // before the background logActivity completes or the poll refreshes.
      const newLog = {
        id: `temp-create-${Date.now()}`,
        created_at: new Date().toISOString(),
        user_id: authState.user?.id,
        action_type: 'create_entity',
        details: { label, type: dbType },
        sessions: { name: session?.name || 'session' }
      }
      setActivityLogs(prev => [newLog, ...prev])

      // Persist to DB in background
      logActivity('create_entity', { label, type: dbType })

      return true
    } catch (err) {
      setError(err.message || 'Failed to add tag')
      return false
    }
  }, [sessionId, campaignId, authState, session, isGuest])

  const removeTag = useCallback(async (tagId, tagDetails = null) => {
    // For guest users, remove from local state only
    if (isGuest) {
      // Find the tag before removing to get its details for the activity log
      const tagToRemove = tags.find(t => t.id === tagId)
      
      setTags(prev => {
        const newTags = prev.filter(t => t.id !== tagId)
        try {
          sessionStorage.setItem(`${GUEST_TAGS_STORAGE_KEY}:${sessionId}`, JSON.stringify(newTags))
        } catch {
          // Ignore storage errors
        }
        return newTags
      })
      
      // Add activity log for the tag deletion
      if (tagToRemove) {
        const newActivity = {
          id: `activity-${Date.now()}`,
          session_id: sessionId,
          user_id: authState.user?.id,
          action_type: 'delete_entity',
          details: {
            label: tagToRemove.label,
            type: tagToRemove.tag_type,
            session_name: session?.name || 'Session',
          },
          created_at: new Date().toISOString(),
        }
        setActivityLogs(prev => [newActivity, ...prev])
      }
      
      return
    }

    try {
      // Validate tag ID before deletion
      const validatedTagId = validateTagId(tagId)
      
      // Find the tag first so we can log its removal
      // Prefer passed details, fallback to finding in state
      const tagToRemove = tagDetails || tags.find(t => t.id === validatedTagId)
      
      const { error } = await requireSupabase().from('entity_tags').delete().eq('id', validatedTagId)
      if (error) throw error
      
      setTags(prev => prev.filter(t => t.id !== validatedTagId))
      
      // Log removal if tag was found
      if (tagToRemove) {
        // Manually update activity logs immediately for responsive UI
        const newLog = {
          id: `temp-${Date.now()}`,
          created_at: new Date().toISOString(),
          user_id: authState.user?.id,
          action_type: 'delete_entity',
          details: { 
            label: tagToRemove.label, 
            type: tagToRemove.tag_type 
          },
          sessions: { name: session?.name || 'session' }
        }
        setActivityLogs(prev => [newLog, ...prev])

        // Persist to DB in background
        logActivity('delete_entity', { 
          label: tagToRemove.label, 
          type: tagToRemove.tag_type 
        })
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.getClientMessage())
      } else {
        setError(err.message || 'Failed to remove tag')
      }
    }
  }, [tags, logActivity, session?.name, authState.user?.id, isGuest, sessionId])

  const updateTag = useCallback(async (tagId, updates) => {
    // For guest users, update in local state only
    if (isGuest) {
      setTags(prev => {
        const newTags = prev.map(t => t.id === tagId ? { ...t, ...updates } : t)
        try {
          sessionStorage.setItem(`${GUEST_TAGS_STORAGE_KEY}:${sessionId}`, JSON.stringify(newTags))
        } catch {
          // Ignore storage errors
        }
        return newTags
      })
      return true
    }

    try {
      // Validate tag ID and updates
      const validatedTagId = validateTagId(tagId)
      const validated = validateUpdateEntityTag(updates)
      
      const { error } = await requireSupabase()
        .from('entity_tags')
        .update(validated)
        .eq('id', validatedTagId)
      
      if (error) throw error
      
      setTags(prev => prev.map(t => t.id === validatedTagId ? { ...t, ...validated } : t))
      return true
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.getClientMessage())
      } else {
        setError(err.message || 'Failed to update tag')
      }
      return false
    }
  }, [isGuest, sessionId])

  useEffect(() => {
    if (sessionId && campaignId) loadSession()
  }, [sessionId, campaignId, loadSession])

  return {
    session,
    inviteCode,
    campaignMembers,
    noteContent,
    setNoteContent,
    tags,
    activityLogs,
    sessionNotes,
    loading,
    error,
    saving,
    saveNote,
    addTag,
    removeTag,
    updateTag
  }
}
