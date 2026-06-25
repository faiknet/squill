import { useState, useEffect, useCallback } from 'react'
import { requireSupabase } from './supabase'
import { useAuth } from '../hooks/useSupabaseAuth'

// LocalStorage cache helper
const getCacheKey = (campaignId) => `squill:cache:display-name:${campaignId}`

export function useCampaignDisplayName(campaignId) {
  const { authState } = useAuth()
  const { user, isGuest } = authState
  const [displayName, setDisplayNameState] = useState(() => {
    if (!campaignId) return null
    try {
      return localStorage.getItem(getCacheKey(campaignId)) || null
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load from Supabase on mount/campaignId change
  useEffect(() => {
    if (!campaignId || isGuest || !user) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    async function fetchDisplayName() {
      setIsLoading(true)
      try {
        const client = requireSupabase()
        const { data, error: fetchError } = await client
          .from('campaign_display_preferences')
          .select('display_name')
          .eq('campaign_id', campaignId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (fetchError) throw fetchError

        if (isMounted) {
          const val = data?.display_name || null
          setDisplayNameState(val)
          try {
            if (val) {
              localStorage.setItem(getCacheKey(campaignId), val)
            } else {
              localStorage.removeItem(getCacheKey(campaignId))
            }
          } catch {}
        }
      } catch (err) {
        console.error('Failed to fetch campaign display name:', err)
        if (isMounted) setError(err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchDisplayName()
    return () => {
      isMounted = false
    }
  }, [campaignId, user?.id, isGuest])

  const setDisplayName = useCallback(async (name) => {
    if (!campaignId) return
    const cleanName = name?.trim() || null

    // 1. Optimistically update local state & cache
    setDisplayNameState(cleanName)
    try {
      if (cleanName) {
        localStorage.setItem(getCacheKey(campaignId), cleanName)
      } else {
        localStorage.removeItem(getCacheKey(campaignId))
      }
    } catch {}

    if (isGuest || !user) return

    // 2. Upsert to Supabase
    try {
      const client = requireSupabase()
      const { error: upsertError } = await client
        .from('campaign_display_preferences')
        .upsert({
          user_id: user.id,
          campaign_id: campaignId,
          display_name: cleanName,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,campaign_id'
        })

      if (upsertError) throw upsertError
    } catch (err) {
      console.error('Failed to save campaign display name:', err)
      setError(err)
      throw err
    }
  }, [campaignId, user?.id, isGuest])

  return { displayName, isLoading, error, setDisplayName }
}

export function useCampaignDisplayNames(campaignIds = []) {
  const { authState } = useAuth()
  const { user, isGuest } = authState
  const [displayNameMap, setDisplayNameMap] = useState(() => {
    const initialMap = new Map()
    if (campaignIds.length > 0) {
      campaignIds.forEach(id => {
        try {
          const cached = localStorage.getItem(getCacheKey(id))
          if (cached) initialMap.set(id, cached)
        } catch {}
      })
    }
    return initialMap
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const cleanIds = campaignIds.filter(Boolean)
    if (cleanIds.length === 0 || isGuest || !user) {
      setIsLoading(false)
      return
    }

    let isMounted = true
    async function fetchDisplayNames() {
      setIsLoading(true)
      try {
        const client = requireSupabase()
        const { data, error: fetchError } = await client
          .from('campaign_display_preferences')
          .select('campaign_id, display_name, updated_at')
          .in('campaign_id', cleanIds)
          .order('updated_at', { ascending: false })

        if (fetchError) throw fetchError

        if (isMounted) {
          const newMap = new Map()
          // Seed with current cache first
          cleanIds.forEach(id => {
            try {
              const cached = localStorage.getItem(getCacheKey(id))
              if (cached) newMap.set(id, cached)
            } catch {}
          })
          
          // Apply server results (latest first, so skip duplicate campaigns since they are older)
          const processedCampaigns = new Set()
          data?.forEach(row => {
            if (processedCampaigns.has(row.campaign_id)) return
            processedCampaigns.add(row.campaign_id)

            if (row.display_name) {
              newMap.set(row.campaign_id, row.display_name)
              try {
                localStorage.setItem(getCacheKey(row.campaign_id), row.display_name)
              } catch {}
            } else {
              newMap.delete(row.campaign_id)
              try {
                localStorage.removeItem(getCacheKey(row.campaign_id))
              } catch {}
            }
          })
          setDisplayNameMap(newMap)
        }
      } catch (err) {
        console.error('Failed to bulk fetch campaign display names:', err)
        if (isMounted) setError(err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchDisplayNames()
    return () => {
      isMounted = false
    }
  }, [JSON.stringify(campaignIds), user?.id, isGuest])

  return { displayNameMap, isLoading, error }
}
