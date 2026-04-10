import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../lib/supabase'
import { useAuth } from './useSupabaseAuth'
import { fetchSessionPageData } from '../lib/sessionPageQuery'
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
  getGuestSessionsForCampaign,
  getGuestSessionBySlug,
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

export function useSessionData(sessionId, campaignId, routeParams = {}) {
  const queryClient = useQueryClient()
  const { authState } = useAuth()
  const { isGuest } = authState
  const { campaignSlug = null, sessionSlug = null } = routeParams
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
  const [resolvedSessionId, setResolvedSessionId] = useState(sessionId || null)
  const [resolvedCampaignId, setResolvedCampaignId] = useState(campaignId || null)
  const guestTagIdCounter = useRef(100)

  useEffect(() => {
    if (sessionId && campaignId) {
      setResolvedSessionId(sessionId)
      setResolvedCampaignId(campaignId)
    }
  }, [sessionId, campaignId])

  const resolveRouteIds = useCallback(async () => {
    if (resolvedSessionId && resolvedCampaignId) {
      return { sessionId: resolvedSessionId, campaignId: resolvedCampaignId }
    }

    if (!campaignSlug || !sessionSlug) return null

    try {
      return await queryClient.fetchQuery({
        queryKey: [
          'session-route-ids',
          isGuest ? 'guest' : 'auth',
          authState.user?.id || 'anonymous',
          campaignSlug,
          sessionSlug,
        ],
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
          if (isGuest) {
            const userId = authState.user?.id
            if (!userId) throw new Error('Guest user not found.')
            const guestRoute = getGuestSessionBySlug(userId, campaignSlug, sessionSlug)
            if (!guestRoute) throw new Error('Session not found.')
            return { sessionId: guestRoute.session.id, campaignId: guestRoute.campaign.id }
          }

          const client = requireSupabase()
          const joinedRoute = await client
            .from('sessions')
            .select('id, campaign_id, campaigns!inner(slug)')
            .eq('slug', sessionSlug)
            .eq('campaigns.slug', campaignSlug)
            .maybeSingle()

          if (!joinedRoute.error && joinedRoute.data) {
            return { sessionId: joinedRoute.data.id, campaignId: joinedRoute.data.campaign_id }
          }

          const { data: campaignData, error: campaignError } = await client
            .from('campaigns')
            .select('id')
            .eq('slug', campaignSlug)
            .maybeSingle()
          if (campaignError || !campaignData) throw new Error('Campaign not found.')

          const { data: sessionData, error: sessionError } = await client
            .from('sessions')
            .select('id')
            .eq('slug', sessionSlug)
            .eq('campaign_id', campaignData.id)
            .maybeSingle()
          if (sessionError || !sessionData) throw new Error('Session not found.')

          return { sessionId: sessionData.id, campaignId: campaignData.id }
        },
      })
    } catch {
      return null
    }
  }, [
    queryClient,
    resolvedSessionId,
    resolvedCampaignId,
    isGuest,
    authState.user?.id,
    campaignSlug,
    sessionSlug,
  ])

  // Load guest session data
  const loadGuestSession = useCallback((activeSessionId, activeCampaignId) => {
    const userId = authState.user?.id
    if (!userId || !activeSessionId || !activeCampaignId) return

    const guestSession = getGuestSessionsForCampaign(activeCampaignId).find((item) => item.id === activeSessionId)
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
      const tagsJson = sessionStorage.getItem(`${GUEST_TAGS_STORAGE_KEY}:${activeSessionId}`)
      if (tagsJson) savedTags = JSON.parse(tagsJson)
    } catch {
      // Ignore storage errors
    }
    const tagsValue = savedTags || getGuestEntityTags(activeCampaignId, activeSessionId)
    const activityLogsValue = getGuestActivityLogs(activeSessionId, userId)

    setSession({ id: guestSession.id, name: guestSession.name, campaign_id: guestSession.campaign_id })
    setNoteContent(noteContentValue)
    setTags(tagsValue)
    setInviteCode('DEMO1234')
    setCampaignMembers(getGuestCampaignMembers(userId))
    setActivityLogs(activityLogsValue)
    setSessionNotes(
      getGuestSessionsForCampaign(activeCampaignId).map(item => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        session_date: item.session_date,
        created_at: item.created_at,
      }))
    )
    setLoading(false)
  }, [authState.user?.id])

  const loadSession = useCallback(async () => {
    setLoading(true)
    setError('')
    const routeIds = await resolveRouteIds()
    if (!routeIds) {
      setError('Session not found.')
      setLoading(false)
      return
    }

    const activeSessionId = routeIds.sessionId
    const activeCampaignId = routeIds.campaignId
    setResolvedSessionId(activeSessionId)
    setResolvedCampaignId(activeCampaignId)

    // Handle guest users with local demo data
    if (isGuest) {
      loadGuestSession(activeSessionId, activeCampaignId)
      return
    }

    try {
      const client = requireSupabase()
      const payload = await queryClient.fetchQuery({
        queryKey: ['session-page-data', activeCampaignId, activeSessionId],
        staleTime: 30 * 1000,
        queryFn: () => fetchSessionPageData(client, activeCampaignId, activeSessionId),
      })

      setSession(payload.session || null)
      setNoteContent(payload.noteContent || '<p></p>')
      setTags(payload.tags || [])
      setCampaignMembers(payload.campaignMembers || [])
      setInviteCode(payload.inviteCode || null)
      setActivityLogs(payload.activityLogs || [])
      setSessionNotes(payload.sessionNotes || [])
    } catch (err) {
      setError(err.message || 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [isGuest, loadGuestSession, resolveRouteIds, queryClient])

  // Keep activity logs fresh with realtime events and adaptive backoff polling
  useEffect(() => {
    if (!resolvedCampaignId || isGuest) return

    const client = requireSupabase()
    let disposed = false
    let pollTimeoutId = null
    let failureCount = 0
    let realtimeConnected = false
    const realtimeChannel = client
      .channel(`session-activity-${resolvedCampaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_activity_logs' },
        async () => {
          await pollActivityLogs()
          scheduleNextPoll()
        }
      )

    const getSessionIds = async () => {
      const knownSessionIds = (sessionNotes || []).map((item) => item.id).filter(Boolean)
      if (knownSessionIds.length > 0) return knownSessionIds
      const { data: sessionList } = await client
        .from('sessions')
        .select('id')
        .eq('campaign_id', resolvedCampaignId)
      return (sessionList || []).map((item) => item.id).filter(Boolean)
    }

    const pollActivityLogs = async () => {
      try {
        const sessionIds = await getSessionIds()
        if (sessionIds.length === 0) {
          failureCount = 0
          if (!disposed) setActivityLogs([])
          return true
        }

        const { data, error } = await client
          .from('session_activity_logs')
          .select('*')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })
          .limit(100)

        if (error) {
          throw error
        } else {
          failureCount = 0
          if (!disposed) setActivityLogs(data || [])
        }
        return true
      } catch (err) {
        failureCount = Math.min(failureCount + 1, 5)
        console.error('Activity refresh failed:', err)
        return false
      }
    }

    const scheduleNextPoll = () => {
      if (disposed) return
      if (pollTimeoutId) clearTimeout(pollTimeoutId)

      const baseDelay = realtimeConnected ? 30000 : 5000
      const delayWithBackoff = realtimeConnected
        ? baseDelay
        : Math.min(60000, baseDelay * (2 ** failureCount))
      const visibilityAdjustedDelay =
        typeof document !== 'undefined' && document.hidden
          ? Math.max(delayWithBackoff, 30000)
          : delayWithBackoff

      pollTimeoutId = setTimeout(async () => {
        await pollActivityLogs()
        scheduleNextPoll()
      }, visibilityAdjustedDelay)
    }

    const handleVisibilityChange = async () => {
      if (disposed || typeof document === 'undefined') return
      if (!document.hidden) {
        await pollActivityLogs()
      }
      scheduleNextPoll()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    realtimeChannel.subscribe((status) => {
      realtimeConnected = status === 'SUBSCRIBED'
      scheduleNextPoll()
    })

    void pollActivityLogs().then(() => {
      scheduleNextPoll()
    })

    return () => {
      disposed = true
      if (pollTimeoutId) clearTimeout(pollTimeoutId)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
      void client.removeChannel(realtimeChannel)
    }
  }, [resolvedCampaignId, isGuest, sessionNotes])

  const logActivity = useCallback(async (actionType, detailsOrName) => {
    try {
      if (!resolvedSessionId) return
      const client = requireSupabase()
      const userId = authState.user?.id
      // Allow passing either a string (sessionName) or an object for details
      const details = typeof detailsOrName === 'string' 
        ? { session_name: detailsOrName } 
        : (detailsOrName || {})
        
      console.log('logActivity called:', { actionType, userId, sessionId: resolvedSessionId, details })
      if (!userId) {
        console.warn('No userId, skipping activity log')
        return
      }

      // Check last activity of this type for this user in this session
      const { data: lastActivity, error: checkError } = await client
        .from('session_activity_logs')
        .select('created_at')
        .eq('session_id', resolvedSessionId)
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
          session_id: resolvedSessionId,
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
  }, [resolvedSessionId, authState.user?.id])

  const saveNote = useCallback(async (content) => {
    if (!resolvedSessionId) return
    setSaving(true)
    setError('')

    // For guest users, save to sessionStorage instead
    if (isGuest) {
      try {
        sessionStorage.setItem(GUEST_NOTE_STORAGE_KEY, content)
        setNoteContent(content)

        const now = Date.now()
        let shouldLogEditActivity = true
        const guestEditActivityKey = `squill_guest_last_edit_activity_at:${resolvedSessionId}:${authState.user?.id || 'guest'}`

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
            session_id: resolvedSessionId,
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
      const validatedSessionId = validateSessionId(resolvedSessionId)
      
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
  }, [resolvedSessionId, logActivity, session?.name, isGuest, authState.user?.id])

  const addTag = useCallback(async (type, label) => {
    if (!resolvedSessionId || !resolvedCampaignId) return false
    // For guest users, add tag to local state only
    if (isGuest) {
      const dbType = type === 'inventory' ? 'item' : type
      const newTag = {
        id: `guest-tag-${guestTagIdCounter.current++}`,
        campaign_id: resolvedCampaignId,
        session_id: resolvedSessionId,
        label,
        tag_type: dbType,
        created_by: authState.user?.id,
        created_at: new Date().toISOString(),
        sessions: { name: session?.name || 'Session' },
      }
      setTags(prev => {
        const newTags = [newTag, ...prev]
        try {
          sessionStorage.setItem(`${GUEST_TAGS_STORAGE_KEY}:${resolvedSessionId}`, JSON.stringify(newTags))
        } catch {
          // Ignore storage errors
        }
        return newTags
      })
      
      // Add activity log for the tag creation
      const newActivity = {
        id: `activity-${Date.now()}`,
        session_id: resolvedSessionId,
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
        sessionId: resolvedSessionId,
        description: undefined
      })

      // Map frontend types to database types
      let dbType = validated.tagType
      
      const { data, error } = await requireSupabase()
        .from('entity_tags')
        .insert({
          session_id: resolvedSessionId,
          campaign_id: resolvedCampaignId,
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
  }, [resolvedSessionId, resolvedCampaignId, authState, session, isGuest, logActivity])

  const removeTag = useCallback(async (tagId, tagDetails = null) => {
    if (!resolvedSessionId) return
    // For guest users, remove from local state only
    if (isGuest) {
      // Find the tag before removing to get its details for the activity log
      const tagToRemove = tags.find(t => t.id === tagId)
      
      setTags(prev => {
        const newTags = prev.filter(t => t.id !== tagId)
        try {
          sessionStorage.setItem(`${GUEST_TAGS_STORAGE_KEY}:${resolvedSessionId}`, JSON.stringify(newTags))
        } catch {
          // Ignore storage errors
        }
        return newTags
      })
      
      // Add activity log for the tag deletion
      if (tagToRemove) {
        const newActivity = {
          id: `activity-${Date.now()}`,
          session_id: resolvedSessionId,
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
  }, [tags, logActivity, session?.name, authState.user?.id, isGuest, resolvedSessionId])

  const updateTag = useCallback(async (tagId, updates) => {
    // For guest users, update in local state only
    if (isGuest) {
      setTags(prev => {
        const newTags = prev.map(t => t.id === tagId ? { ...t, ...updates } : t)
        try {
          if (resolvedSessionId) {
            sessionStorage.setItem(`${GUEST_TAGS_STORAGE_KEY}:${resolvedSessionId}`, JSON.stringify(newTags))
          }
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
  }, [isGuest, resolvedSessionId])

  useEffect(() => {
    if (authState.isLoading) return
    if ((sessionId && campaignId) || (campaignSlug && sessionSlug)) {
      loadSession()
    } else {
      setLoading(false)
    }
  }, [authState.isLoading, sessionId, campaignId, campaignSlug, sessionSlug, loadSession])

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
