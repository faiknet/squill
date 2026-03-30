import { useState, useEffect, useCallback } from 'react'
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

export function useSessionData(sessionId, campaignId) {
  const { authState } = useAuth()
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

  const loadSession = useCallback(async () => {
    try {
      const client = requireSupabase()
      
      const [sessionRes, noteRes, tagsRes, membersRes, campaignRes, allSessionsRes] = await Promise.all([
        client.from('sessions').select('id, name, campaign_id').eq('id', sessionId).single(),
        client.from('session_notes').select('content_md, updated_at').eq('session_id', sessionId).maybeSingle(),
        client.from('entity_tags').select('*, sessions(name)').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
        client.rpc('get_campaign_members', { p_campaign_id: campaignId }),
        client.from('campaigns').select('invite_code').eq('id', campaignId).single(),
        // Get all sessions in this campaign
        client.from('sessions').select('id, name').eq('campaign_id', campaignId),
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
          .select('*, sessions!inner(id, name)')
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
  }, [sessionId, campaignId])

  // Poll for activity log changes for ALL sessions in the campaign
  useEffect(() => {
    if (!campaignId) return

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
          .select('*, sessions!inner(id, name)')
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
  }, [campaignId])

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
      // If found, check if it was less than 1 hour ago
      if (lastActivity) {
        const lastTime = new Date(lastActivity.created_at)
        const diffHours = (now - lastTime) / (1000 * 60 * 60)
        // Only throttle 'edit_document' actions, allow 'delete_entity' to go through
        if (actionType === 'edit_document' && diffHours < 1) {
          console.log('Activity log throttled (less than 1 hour since last)', actionType)
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
    console.log('saveNote called, about to save...')
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
  }, [sessionId, logActivity, session?.name])

  const addTag = useCallback(async (type, label) => {
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
  }, [sessionId, campaignId, authState, session])

  const removeTag = useCallback(async (tagId, tagDetails = null) => {
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
  }, [tags, logActivity, session?.name, authState.user?.id])

  const updateTag = useCallback(async (tagId, updates) => {
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
  }, [])

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
