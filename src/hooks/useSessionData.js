import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

// Background helper to log activities to Supabase without blocking UI
async function logActivityBackground(sessionId, userId, actionType, sessionNameOrDetails) {
  try {
    const client = requireSupabase()
    
    // Normalize details
    const details = typeof sessionNameOrDetails === 'string'
      ? { session_name: sessionNameOrDetails }
      : (sessionNameOrDetails || {})
      
    if (!userId) return

    // Throttle check for edit_document
    const { data: lastActivity } = await client
      .from('session_activity_logs')
      .select('created_at')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('action_type', actionType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = new Date()
    if (lastActivity) {
      const lastTime = new Date(lastActivity.created_at)
      const diffMinutes = (now - lastTime) / (1000 * 60)
      if (actionType === 'edit_document' && diffMinutes < 120) {
        return // Throttled to once every 2 hours
      }
    }

    // Insert new activity
    await client
      .from('session_activity_logs')
      .insert({
        session_id: sessionId,
        user_id: userId,
        action_type: actionType,
        details: details
      })
  } catch (err) {
    console.error('Failed to log activity in background:', err)
  }
}

export function useSessionData(sessionId, campaignId) {
  const { authState } = useAuth()
  const { isGuest } = authState
  const queryClient = useQueryClient()
  const guestTagIdCounter = useRef(100)

  // --- Local State for Guest Mode ---
  const [guestSession, setGuestSession] = useState(null)
  const [guestNoteContent, setGuestNoteContent] = useState('<p></p>')
  const [guestTags, setGuestTags] = useState([])
  const [guestCampaignMembers, setGuestCampaignMembers] = useState([])
  const [guestInviteCode, setGuestInviteCode] = useState(null)
  const [guestActivityLogs, setGuestActivityLogs] = useState([])
  const [guestSessionNotes, setGuestSessionNotes] = useState([])
  const [guestLoading, setGuestLoading] = useState(true)
  const [guestError, setGuestError] = useState('')
  const [guestSaving, setGuestSaving] = useState(false)

  // Load guest session data
  const loadGuestSession = useCallback(() => {
    const userId = authState.user?.id
    if (!userId || !sessionId || !campaignId) return

    const guestSession = getGuestSessionsForCampaign(campaignId).find((item) => item.id === sessionId)
    if (!guestSession) {
      setGuestError('Guest session not found')
      setGuestLoading(false)
      return
    }
    
    let savedNote = null
    let savedSchemaVersion = null
    try {
      savedNote = sessionStorage.getItem(GUEST_NOTE_STORAGE_KEY)
      savedSchemaVersion = sessionStorage.getItem(GUEST_NOTE_SCHEMA_VERSION_KEY)
    } catch {}

    let noteContentValue = savedNote || getGuestSessionNote()

    if (savedNote && savedSchemaVersion !== GUEST_NOTE_SCHEMA_VERSION) {
      noteContentValue = getGuestSessionNote()
      try {
        sessionStorage.setItem(GUEST_NOTE_STORAGE_KEY, noteContentValue)
        sessionStorage.setItem(GUEST_NOTE_SCHEMA_VERSION_KEY, GUEST_NOTE_SCHEMA_VERSION)
      } catch {}
    } else if (!savedNote) {
      try {
        sessionStorage.setItem(GUEST_NOTE_SCHEMA_VERSION_KEY, GUEST_NOTE_SCHEMA_VERSION)
      } catch {}
    }

    let savedTags = null
    try {
      const tagsJson = sessionStorage.getItem(`${GUEST_TAGS_STORAGE_KEY}:${sessionId}`)
      if (tagsJson) savedTags = JSON.parse(tagsJson)
    } catch {}

    const tagsValue = savedTags || getGuestEntityTags(campaignId, sessionId)
    const activityLogsValue = getGuestActivityLogs(sessionId, userId)

    setGuestSession({ id: guestSession.id, name: guestSession.name, campaign_id: guestSession.campaign_id })
    setGuestNoteContent(noteContentValue)
    setGuestTags(tagsValue)
    setGuestInviteCode('DEMO1234')
    setGuestCampaignMembers(getGuestCampaignMembers(userId))
    setGuestActivityLogs(activityLogsValue)
    setGuestSessionNotes(
      getGuestSessionsForCampaign(campaignId).map(item => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        session_date: item.session_date,
        created_at: item.created_at,
      }))
    )
    setGuestLoading(false)
  }, [authState.user?.id, sessionId, campaignId])

  useEffect(() => {
    if (isGuest && sessionId && campaignId) {
      loadGuestSession()
    }
  }, [isGuest, sessionId, campaignId, loadGuestSession])


  // --- React Query for Authenticated Mode ---

  // 1. Session Query
  const sessionQuery = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const client = requireSupabase()
      const { data, error } = await client
        .from('sessions')
        .select('id, name, campaign_id')
        .eq('id', sessionId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!sessionId && !isGuest,
    staleTime: 5 * 60 * 1000,
  })

  // 2. Note Content Query
  const noteQuery = useQuery({
    queryKey: ['session-notes', sessionId],
    queryFn: async () => {
      const client = requireSupabase()
      const { data, error } = await client
        .from('session_notes')
        .select('content_md, updated_at')
        .eq('session_id', sessionId)
        .maybeSingle()
      if (error) throw error
      return data?.content_md || '<p></p>'
    },
    enabled: !!sessionId && !isGuest,
    staleTime: 60 * 1000,
  })

  // 3. Tags Query
  const tagsQuery = useQuery({
    queryKey: ['entity-tags', campaignId],
    queryFn: async () => {
      const client = requireSupabase()
      const { data, error } = await client
        .from('entity_tags')
        .select('*, sessions(name)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!campaignId && !isGuest,
    staleTime: 5 * 60 * 1000,
  })

  // 4. Invite Code Query
  const inviteCodeQuery = useQuery({
    queryKey: ['invite-code', campaignId],
    queryFn: async () => {
      const client = requireSupabase()
      const { data, error } = await client
        .from('campaigns')
        .select('invite_code')
        .eq('id', campaignId)
        .single()
      if (error) throw error
      return data?.invite_code || null
    },
    enabled: !!campaignId && !isGuest,
    staleTime: 24 * 60 * 60 * 1000,
  })

  // 5. Session Notes List
  const sessionNotesListQuery = useQuery({
    queryKey: ['session-notes-list', campaignId],
    queryFn: async () => {
      const client = requireSupabase()
      const { data, error } = await client
        .from('sessions')
        .select('id, name, slug, session_date, created_at')
        .eq('campaign_id', campaignId)
      if (error) throw error
      return data || []
    },
    enabled: !!campaignId && !isGuest,
    staleTime: 5 * 60 * 1000,
  })

  // 6. Campaign Members Query
  const membersQuery = useQuery({
    queryKey: ['campaign-members', campaignId],
    queryFn: async () => {
      const client = requireSupabase()
      const { data: members, error: membersError } = await client.rpc('get_campaign_members', { p_campaign_id: campaignId })
      if (membersError) throw membersError

      const { data: displayPrefs } = await client
        .from('campaign_display_preferences')
        .select('user_id, display_name')
        .eq('campaign_id', campaignId)

      const prefMap = new Map()
      displayPrefs?.forEach(p => {
        if (p.display_name) prefMap.set(p.user_id, p.display_name)
      })

      const membersWithNames = (members || []).map(m => ({
        ...m,
        display_name: prefMap.get(m.user_id) || m.display_name
      }))

      const memberIds = membersWithNames.map(m => m.user_id)
      if (memberIds.length > 0) {
        try {
          const colorRes = await client.rpc('get_user_colors', { user_ids: memberIds })
          if (colorRes.error) throw colorRes.error
          
          const colorMap = new Map()
          colorRes.data?.forEach(item => {
            colorMap.set(item.user_id, item.editor_color)
          })
          
          return membersWithNames.map(member => ({
            ...member,
            color: colorMap.get(member.user_id)
          }))
        } catch (err) {
          console.debug('Error fetching colors:', err.message)
          return membersWithNames
        }
      }
      return membersWithNames
    },
    enabled: !!campaignId && !isGuest,
    staleTime: 5 * 60 * 1000,
  })

  // 7. Activity Logs Query
  const activityLogsQuery = useQuery({
    queryKey: ['activity-logs', campaignId],
    queryFn: async () => {
      const client = requireSupabase()
      const sessions = sessionNotesListQuery.data || []
      const sessionIds = sessions.map(s => s.id)
      if (sessionIds.length === 0) return []

      const { data, error } = await client
        .from('session_activity_logs')
        .select('*')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data || []
    },
    enabled: !!campaignId && !isGuest && !!sessionNotesListQuery.data,
    staleTime: 5 * 60 * 1000,
  })


  // --- Supabase Realtime Subscriptions ---
  useEffect(() => {
    if (!campaignId || isGuest || !sessionNotesListQuery.data) return

    const client = requireSupabase()
    const sessions = sessionNotesListQuery.data
    const sessionIds = sessions.map(s => s.id)
    if (sessionIds.length === 0) return

    // Realtime Activity Logs Channel
    const activityChannel = client
      .channel(`realtime-activities-${campaignId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'session_activity_logs',
      }, (payload) => {
        if (sessionIds.includes(payload.new.session_id)) {
          queryClient.setQueryData(['activity-logs', campaignId], (old = []) => {
            if (old.some(log => log.id === payload.new.id)) return old
            return [payload.new, ...old].slice(0, 100)
          })
        }
      })
      .subscribe()

    // Realtime Tags Channel
    const tagsChannel = client
      .channel(`realtime-tags-${campaignId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'entity_tags',
        filter: `campaign_id=eq.${campaignId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          queryClient.setQueryData(['entity-tags', campaignId], (old = []) => {
            if (old.some(tag => tag.id === payload.new.id)) return old
            const matchedSession = sessions.find(s => s.id === payload.new.session_id)
            const newTag = {
              ...payload.new,
              sessions: matchedSession ? { name: matchedSession.name } : null
            }
            return [newTag, ...old]
          })
        } else if (payload.eventType === 'UPDATE') {
          queryClient.setQueryData(['entity-tags', campaignId], (old = []) => {
            return old.map(tag => tag.id === payload.new.id ? { ...tag, ...payload.new } : tag)
          })
        } else if (payload.eventType === 'DELETE') {
          queryClient.setQueryData(['entity-tags', campaignId], (old = []) => {
            return old.filter(tag => tag.id !== payload.old.id)
          })
        }
      })
      .subscribe()

    return () => {
      client.removeChannel(activityChannel)
      client.removeChannel(tagsChannel)
    }
  }, [campaignId, isGuest, sessionNotesListQuery.data, queryClient])


  // --- Mutations ---

  const [mutationError, setMutationError] = useState(null)

  const clearMutationError = useCallback(() => setMutationError(null), [])

  // 1. Save Note Content
  const saveNoteMutation = useMutation({
    mutationFn: async ({ content, isUserEdit }) => {
      const client = requireSupabase()
      const validatedContent = validateUpdateNote({ contentMd: content })
      const validatedSessionId = validateSessionId(sessionId)
      
      const { error } = await client
        .from('session_notes')
        .upsert({
          session_id: validatedSessionId,
          content_md: validatedContent.contentMd,
          liveblocks_id: validatedSessionId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'session_id' })
      if (error) throw error

      const user = authState.user
      if (user && isUserEdit) {
        await logActivityBackground(sessionId, user.id, 'edit_document', sessionQuery.data?.name)
      }
    },
    onMutate: async ({ content }) => {
      await queryClient.cancelQueries({ queryKey: ['session-notes', sessionId] })
      const previousNote = queryClient.getQueryData(['session-notes', sessionId])
      queryClient.setQueryData(['session-notes', sessionId], content)
      return { previousNote }
    },
    onError: (err, { content }, context) => {
      if (context?.previousNote !== undefined) {
        queryClient.setQueryData(['session-notes', sessionId], context.previousNote)
      }
      setMutationError('Failed to save note. Your changes have been reverted.')
    }
  })

  // 2. Add Tag
  const addTagMutation = useMutation({
    mutationFn: async ({ type, label }) => {
      const client = requireSupabase()
      const validated = validateCreateEntityTag({
        name: label,
        tagType: type === 'inventory' ? 'item' : type,
        sessionId: sessionId,
        description: undefined
      })
      const dbType = validated.tagType
      
      const { data, error } = await client
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

      const user = authState.user
      if (user) {
        logActivityBackground(sessionId, user.id, 'create_entity', { label, type: dbType })
      }
      return data
    },
    onMutate: async ({ type, label }) => {
      await queryClient.cancelQueries({ queryKey: ['entity-tags', campaignId] })
      const previousTags = queryClient.getQueryData(['entity-tags', campaignId])

      const dbType = type === 'inventory' ? 'item' : type
      const tempId = `temp-create-${Date.now()}`
      const newTag = {
        id: tempId,
        campaign_id: campaignId,
        session_id: sessionId,
        label,
        tag_type: dbType,
        created_by: authState.user?.id,
        created_at: new Date().toISOString(),
        sessions: { name: sessionQuery.data?.name || 'Session' }
      }

      queryClient.setQueryData(['entity-tags', campaignId], (old = []) => [newTag, ...old])

      const user = authState.user
      if (user) {
        queryClient.setQueryData(['activity-logs', campaignId], (old = []) => {
          const optimisticLog = {
            id: `temp-log-${Date.now()}`,
            session_id: sessionId,
            user_id: user.id,
            action_type: 'create_entity',
            details: { label, type: dbType },
            created_at: new Date().toISOString()
          }
          return [optimisticLog, ...old]
        })
      }
      return { previousTags }
    },
    onError: (err, vars, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(['entity-tags', campaignId], context.previousTags)
      }
      setMutationError('Failed to add tag. Please try again.')
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['entity-tags', campaignId], (old = []) => {
        return old.map(t => t.id.toString().startsWith('temp-create-') ? data : t)
      })
    }
  })

  // 3. Remove Tag
  const removeTagMutation = useMutation({
    mutationFn: async ({ tagId, tagDetails }) => {
      const client = requireSupabase()
      const validatedTagId = validateTagId(tagId)
      
      const { error } = await client.from('entity_tags').delete().eq('id', validatedTagId)
      if (error) throw error

      const user = authState.user
      if (user && tagDetails) {
        logActivityBackground(sessionId, user.id, 'delete_entity', { label: tagDetails.label, type: tagDetails.tag_type })
      }
    },
    onMutate: async ({ tagId, tagDetails }) => {
      await queryClient.cancelQueries({ queryKey: ['entity-tags', campaignId] })
      const previousTags = queryClient.getQueryData(['entity-tags', campaignId])

      queryClient.setQueryData(['entity-tags', campaignId], (old = []) => old.filter(t => t.id !== tagId))

      const user = authState.user
      if (user && tagDetails) {
        queryClient.setQueryData(['activity-logs', campaignId], (old = []) => {
          const optimisticLog = {
            id: `temp-delete-${Date.now()}`,
            session_id: sessionId,
            user_id: user.id,
            action_type: 'delete_entity',
            details: { label: tagDetails.label, type: tagDetails.tag_type },
            created_at: new Date().toISOString()
          }
          return [optimisticLog, ...old]
        })
      }
      return { previousTags }
    },
    onError: (err, vars, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(['entity-tags', campaignId], context.previousTags)
      }
      setMutationError('Failed to remove tag. Please try again.')
    }
  })

  // 4. Update Tag
  const updateTagMutation = useMutation({
    mutationFn: async ({ tagId, updates }) => {
      const client = requireSupabase()
      const validatedTagId = validateTagId(tagId)
      const validated = validateUpdateEntityTag(updates)
      
      const { error } = await client
        .from('entity_tags')
        .update(validated)
        .eq('id', validatedTagId)
      if (error) throw error
    },
    onMutate: async ({ tagId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['entity-tags', campaignId] })
      const previousTags = queryClient.getQueryData(['entity-tags', campaignId])

      queryClient.setQueryData(['entity-tags', campaignId], (old = []) => {
        return old.map(t => t.id === tagId ? { ...t, ...updates } : t)
      })
      return { previousTags }
    },
    onError: (err, vars, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(['entity-tags', campaignId], context.previousTags)
      }
      setMutationError('Failed to update tag. Please try again.')
    }
  })


  // --- Unified Interface ---
  const session = isGuest ? guestSession : sessionQuery.data
  const inviteCode = isGuest ? guestInviteCode : inviteCodeQuery.data
  const campaignMembers = isGuest ? guestCampaignMembers : (membersQuery.data || [])
  const noteContent = isGuest ? guestNoteContent : (noteQuery.data || '<p></p>')
  const tags = isGuest ? guestTags : (tagsQuery.data || [])
  const activityLogs = isGuest ? guestActivityLogs : (activityLogsQuery.data || [])
  const sessionNotes = isGuest ? guestSessionNotes : (sessionNotesListQuery.data || [])
  const loading = isGuest 
    ? guestLoading 
    : (sessionQuery.isLoading || noteQuery.isLoading || tagsQuery.isLoading || membersQuery.isLoading)
  const error = isGuest 
    ? guestError 
    : (sessionQuery.error?.message || noteQuery.error?.message || tagsQuery.error?.message || membersQuery.error?.message || '')
  const saving = isGuest 
    ? guestSaving 
    : saveNoteMutation.isPending

  const saveNote = useCallback(async (content, isUserEdit = false) => {
    if (isGuest) {
      setGuestSaving(true)
      try {
        sessionStorage.setItem(GUEST_NOTE_STORAGE_KEY, content)
        setGuestNoteContent(content)

        const now = Date.now()
        let shouldLogEditActivity = isUserEdit
        const guestEditActivityKey = `squill_guest_last_edit_activity_at:${sessionId || 'guest'}:${authState.user?.id || 'guest'}`

        try {
          const lastActivityAtRaw = localStorage.getItem(guestEditActivityKey)
          const lastActivityAt = Number(lastActivityAtRaw)
          if (Number.isFinite(lastActivityAt) && now - lastActivityAt < GUEST_EDIT_ACTIVITY_THROTTLE_MS) {
            shouldLogEditActivity = false
          }
        } catch {}

        if (shouldLogEditActivity) {
          const newActivity = {
            id: `activity-${now}`,
            session_id: sessionId,
            user_id: authState.user?.id,
            action_type: 'edit_document',
            details: {
              session_name: guestSession?.name || 'Session',
            },
            created_at: new Date(now).toISOString(),
          }

          setGuestActivityLogs(prev => [newActivity, ...prev])

          try {
            localStorage.setItem(guestEditActivityKey, String(now))
          } catch {}
        }
      } catch (err) {
        setGuestError('Failed to save note locally')
      } finally {
        setGuestSaving(false)
      }
      return
    }

    try {
      await saveNoteMutation.mutateAsync({ content, isUserEdit })
    } catch (err) {
      // Handled via React Query mutation
    }
  }, [isGuest, authState.user?.id, sessionId, guestSession, saveNoteMutation])

  const addTag = useCallback(async (type, label) => {
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
        sessions: { name: guestSession?.name || 'Session' },
      }
      setGuestTags(prev => {
        const newTags = [newTag, ...prev]
        try {
          sessionStorage.setItem(`${GUEST_TAGS_STORAGE_KEY}:${sessionId}`, JSON.stringify(newTags))
        } catch {}
        return newTags
      })
      
      const newActivity = {
        id: `activity-${Date.now()}`,
        session_id: sessionId,
        user_id: authState.user?.id,
        action_type: 'create_entity',
        details: {
          label,
          type: dbType,
          session_name: guestSession?.name || 'Session',
        },
        created_at: new Date().toISOString(),
      }
      setGuestActivityLogs(prev => [newActivity, ...prev])
      
      return true
    }

    try {
      await addTagMutation.mutateAsync({ type, label })
      return true
    } catch (err) {
      return false
    }
  }, [isGuest, campaignId, sessionId, authState.user?.id, guestSession, addTagMutation])

  const removeTag = useCallback(async (tagId, tagDetails = null) => {
    if (isGuest) {
      const tagToRemove = guestTags.find(t => t.id === tagId)
      
      setGuestTags(prev => {
        const newTags = prev.filter(t => t.id !== tagId)
        try {
          sessionStorage.setItem(`${GUEST_TAGS_STORAGE_KEY}:${sessionId}`, JSON.stringify(newTags))
        } catch {}
        return newTags
      })
      
      if (tagToRemove) {
        const newActivity = {
          id: `activity-${Date.now()}`,
          session_id: sessionId,
          user_id: authState.user?.id,
          action_type: 'delete_entity',
          details: {
            label: tagToRemove.label,
            type: tagToRemove.tag_type,
            session_name: guestSession?.name || 'Session',
          },
          created_at: new Date().toISOString(),
        }
        setGuestActivityLogs(prev => [newActivity, ...prev])
      }
      return
    }

    try {
      await removeTagMutation.mutateAsync({ tagId, tagDetails })
    } catch (err) {}
  }, [isGuest, guestTags, sessionId, authState.user?.id, guestSession, removeTagMutation])

  const updateTag = useCallback(async (tagId, updates) => {
    if (isGuest) {
      setGuestTags(prev => {
        const newTags = prev.map(t => t.id === tagId ? { ...t, ...updates } : t)
        try {
          sessionStorage.setItem(`${GUEST_TAGS_STORAGE_KEY}:${sessionId}`, JSON.stringify(newTags))
        } catch {}
        return newTags
      })
      return true
    }

    try {
      await updateTagMutation.mutateAsync({ tagId, updates })
      return true
    } catch (err) {
      return false
    }
  }, [isGuest, sessionId, updateTagMutation])

  return {
    session,
    inviteCode,
    campaignMembers,
    noteContent,
    setNoteContent: (content) => {
      // Allow local updates for immediate Tiptap rendering
      if (isGuest) {
        setGuestNoteContent(content)
      } else {
        queryClient.setQueryData(['session-notes', sessionId], content)
      }
    },
    tags,
    activityLogs,
    sessionNotes,
    loading,
    error,
    saving,
    saveNote,
    addTag,
    removeTag,
    updateTag,
    mutationError,
    clearMutationError
  }
}
