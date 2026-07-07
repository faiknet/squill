import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../lib/supabase'
import { useAuth } from './useSupabaseAuth'
import { getGuestCampaigns, createGuestCampaign, getGuestSessionsForCampaign, getGuestCampaignMembers } from '../lib/guestData'
import { createUrlSlug } from '../lib/utils'

export function useCampaigns() {
  const { authState } = useAuth()
  const { user, isGuest } = authState

  return useQuery({
    queryKey: ['campaigns', user?.id],
    queryFn: async () => {
      if (!user) return []

      if (isGuest) {
        return getGuestCampaigns(user.id)
      }

      const client = requireSupabase()
      const [campaignsResult, pinsResult, partySizesResult, sessionsResult] = await Promise.all([
        client
          .from('campaigns')
          .select('id, slug, name, description, created_at, updated_at, created_by, invite_code, streak_count, streak_cadence, label_campaign, label_session, label_member, label_gm')
          .order('created_at', { ascending: false }),
        client.from('campaign_pins').select('campaign_id'),
        client.rpc('get_campaign_party_sizes'),
        client.from('sessions').select('campaign_id')
      ])

      if (campaignsResult.error) throw campaignsResult.error
      if (pinsResult.error) throw pinsResult.error
      if (partySizesResult.error) throw partySizesResult.error
      if (sessionsResult.error) throw sessionsResult.error

      const pinnedIds = new Set((pinsResult.data || []).map(p => p.campaign_id))
      const partySizeMap = new Map((partySizesResult.data || []).map(r => [r.campaign_id, Number(r.party_size) || 0]))
      const sessionCountMap = new Map()
      sessionsResult.data?.forEach(s => {
        sessionCountMap.set(s.campaign_id, (sessionCountMap.get(s.campaign_id) || 0) + 1)
      })

      const processed = (campaignsResult.data || []).map(c => ({
        ...c,
        party_size: partySizeMap.get(c.id) ?? 0,
        session_count: sessionCountMap.get(c.id) ?? 0,
        pinned: pinnedIds.has(c.id),
      }))

      // Sort: pinned first, then recently updated
      processed.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
      })

      return processed
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
  })
}

export function useCreateCampaignMutation() {
  const { authState } = useAuth()
  const { user, isGuest } = authState
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, description }) => {
      if (!user) throw new Error('User not logged in')

      const slug = createUrlSlug(name)

      if (isGuest) {
        const guestCampaign = createGuestCampaign(user.id, {
          name,
          description,
          slug,
        })
        return guestCampaign
      }

      const client = requireSupabase()
      const { data, error } = await client
        .from('campaigns')
        .insert([{ name, description, slug, created_by: user.id }])
        .select()
        .single()

      if (error) throw error

      const { error: memberError } = await client
        .from('campaign_members')
        .insert({ campaign_id: data.id, user_id: user.id })

      if (memberError) throw memberError

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', user?.id] })
    }
  })
}

export function useUpdateCampaignMutation() {
  const { authState } = useAuth()
  const { user } = authState
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name, description }) => {
      if (authState.isGuest) {
        // Guest campaign editing is done in sessionStorage directly by CampaignDetail/Settings
        return { id, name, description }
      }

      const client = requireSupabase()
      const { data, error } = await client.rpc('update_campaign_as_gm', {
        p_campaign_id: id,
        p_name: name,
        p_description: description
      })

      if (error) throw error
      if (!data || data.length === 0) throw new Error('Failed to update. Permission denied or campaign deleted.')

      return data[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', user?.id] })
    }
  })
}

export function useDeleteCampaignMutation() {
  const { authState } = useAuth()
  const { user } = authState
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      if (authState.isGuest) {
        return id
      }

      const { error } = await requireSupabase()
        .from('campaigns')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', user?.id] })
    }
  })
}

export function useTogglePinCampaignMutation() {
  const { authState } = useAuth()
  const { user } = authState
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaign) => {
      if (authState.isGuest) {
        return campaign
      }

      const client = requireSupabase()
      
      // Delete existing pin
      const { error: deleteError } = await client
        .from('campaign_pins')
        .delete()
        .eq('campaign_id', campaign.id)
        .eq('user_id', user.id)

      if (deleteError) throw deleteError

      // If currently unpinned, insert new pin
      if (!campaign.pinned) {
        const { error: insertError } = await client
          .from('campaign_pins')
          .insert({ campaign_id: campaign.id, user_id: user.id })

        if (insertError) throw insertError
      }

      return campaign
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', user?.id] })
    }
  })
}

// ---------------------------------------------------------------------------
// Shared helper — also exported so CampaignDetail can use it
// ---------------------------------------------------------------------------
export function sortMembersWithGmFirst(members, creatorId) {
  return [...members].sort((a, b) => {
    if (a.user_id === creatorId) return -1
    if (b.user_id === creatorId) return 1
    return 0
  })
}

// ---------------------------------------------------------------------------
// useCampaignDetail
// Loads campaign + sessions + party-members for the CampaignDetail page.
// Cached for 2 min — navigating back is instant after first visit.
// ---------------------------------------------------------------------------
export function useCampaignDetail(campaignSlug) {
  const { authState } = useAuth()
  const { user, isGuest, isLoading: authLoading } = authState

  return useQuery({
    queryKey: ['campaign-detail', campaignSlug, user?.id],
    queryFn: async () => {
      const currentUserId = user?.id ?? null

      // --- Guest mode ---
      if (isGuest) {
        const guestCampaign = getGuestCampaigns(currentUserId).find(c => c.slug === campaignSlug)
        if (!guestCampaign) throw Object.assign(new Error('Campaign not found'), { code: 'NOT_FOUND' })
        return {
          campaign: {
            id: guestCampaign.id,
            slug: guestCampaign.slug,
            name: guestCampaign.name,
            description: guestCampaign.description,
            invite_code: guestCampaign.invite_code,
            created_by: currentUserId,
            streak_count: guestCampaign.streak_count ?? 0,
            streak_cadence: guestCampaign.streak_cadence ?? 'weekly',
            streak_last_period_start: guestCampaign.streak_last_period_start ?? null,
            label_campaign: guestCampaign.label_campaign ?? null,
            label_session: guestCampaign.label_session ?? null,
            label_member: guestCampaign.label_member ?? null,
            label_gm: guestCampaign.label_gm ?? null,
          },
          sessions: getGuestSessionsForCampaign(guestCampaign.id),
          partyMembers: getGuestCampaignMembers(currentUserId),
          membersError: null,
        }
      }

      // --- Authenticated mode ---
      const client = requireSupabase()

      const { data: campaignData, error: campaignError } = await client
        .from('campaigns')
        .select('id, slug, name, description, invite_code, created_by, streak_count, streak_cadence, streak_last_period_start, label_campaign, label_session, label_member, label_gm')
        .eq('slug', campaignSlug)
        .single()

      if (campaignError || !campaignData) {
        throw Object.assign(new Error('Campaign not found'), { code: 'NOT_FOUND' })
      }

      // Fetch members and sessions in parallel
      const [membersRes, sessionsRes] = await Promise.all([
        client.rpc('get_campaign_members', { p_campaign_id: campaignData.id }),
        client
          .from('sessions')
          .select('id, slug, name, session_date, archived, created_at')
          .eq('campaign_id', campaignData.id)
          .order('created_at', { ascending: false }),
      ])

      if (sessionsRes.error) throw sessionsRes.error

      let partyMembers = []
      let membersError = null

      if (membersRes.error) {
        const msg = String(membersRes.error.message || '')
        if (msg.includes('Could not find the function public.get_campaign_members')) {
          membersError = 'Party members are temporarily unavailable. Please try refreshing the page.'
        } else {
          throw membersRes.error
        }
      } else {
        const { data: displayPrefs } = await client
          .from('campaign_display_preferences')
          .select('user_id, display_name')
          .eq('campaign_id', campaignData.id)

        const prefMap = new Map()
        displayPrefs?.forEach(p => {
          if (p.display_name) prefMap.set(p.user_id, p.display_name)
        })

        const resolvedMembers = (membersRes.data || []).map(m => ({
          ...m,
          display_name: prefMap.get(m.user_id) || m.display_name,
        }))

        const memberIds = resolvedMembers.map(m => m.user_id)
        if (memberIds.length > 0) {
          try {
            const { data: colorData, error: colorError } = await client.rpc('get_user_colors', { user_ids: memberIds })
            if (!colorError) {
              const colorMap = new Map()
              colorData?.forEach(item => colorMap.set(item.user_id, item.editor_color))
              partyMembers = resolvedMembers.map(member => ({
                ...member,
                color: colorMap.get(member.user_id),
              }))
            } else {
              console.warn('Could not fetch user colors:', colorError.message)
              partyMembers = resolvedMembers
            }
          } catch (err) {
            console.debug('Error fetching colors:', err.message)
            partyMembers = resolvedMembers
          }
        } else {
          partyMembers = resolvedMembers
        }

        partyMembers = sortMembersWithGmFirst(partyMembers, campaignData.created_by)
      }

      return {
        campaign: campaignData,
        sessions: sessionsRes.data || [],
        partyMembers,
        membersError,
      }
    },
    enabled: !!campaignSlug && !!user && !authLoading,
    staleTime: 2 * 60 * 1000, // 2 min — navigating back is instant
    retry: (failureCount, error) => {
      // Don't retry NOT_FOUND — it won't change
      if (error?.code === 'NOT_FOUND') return false
      return failureCount < 1
    },
  })
}
