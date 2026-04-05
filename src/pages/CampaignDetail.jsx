import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { requireSupabase } from '../lib/supabase'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useMobileMenu } from '../contexts/MobileMenuContext'
import { Button, Card, Input } from '../components/ui'
import { EditSessionModal, DeleteSessionModal } from '../components/sessions'
import { colorFromString } from '../lib/liveblocks'
import { createUrlSlug } from '../lib/utils'
import DeleteCampaignModal from '../components/campaigns/DeleteCampaignModal'
import RemovePlayerModal from '../components/campaigns/RemovePlayerModal'
import TransferGMModal from '../components/campaigns/TransferGMModal'
import {
  validateUpdateCampaign,
  validateCreateSession,
  validateUpdateSession,
  validateCampaignId,
  validateSessionId,
  ValidationError,
} from '../lib/validation'
import {
  GUEST_CAMPAIGN_SLUG,
  getGuestCampaigns,
  getGuestSessionsForCampaign,
  createGuestSession,
  getGuestCampaignMembers,
} from '../lib/guestData'

const STREAK_PERIOD_LABELS = {
  weekly: 'week',
  biweekly: 'biweekly',
  monthly: 'month',
}

function formatCampaignStreak(campaign) {
  if (!campaign || campaign.streak_count <= 0) return ''
  const cadence = campaign.streak_cadence || 'weekly'
  const periodLabel = STREAK_PERIOD_LABELS[cadence] || STREAK_PERIOD_LABELS.weekly
  return `${campaign.streak_count} ${periodLabel} streak`
}

function CampaignDetail() {
  const { campaignSlug } = useParams()
  const navigate = useNavigate()
  const { authState } = useAuth()
  const { isGuest } = authState
  const { setMobileMenuOpen } = useMobileMenu()
  const currentUserId = authState.user?.id ?? null
  const [campaign, setCampaign] = useState(null)
  const [sessions, setSessions] = useState([])
  const [partyMembers, setPartyMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingCampaign, setEditingCampaign] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [campaignDescription, setCampaignDescription] = useState('')
  const [campaignStreakCadence, setCampaignStreakCadence] = useState('weekly')
  const [campaignSaving, setCampaignSaving] = useState(false)
  const [showCreateSession, setShowCreateSession] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [showArchived, setShowArchived] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [copyConfirmation, setCopyConfirmation] = useState('')
  const [editingSession, setEditingSession] = useState(null)
  const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState(null)
  const [isDeleteSessionModalOpen, setIsDeleteSessionModalOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [isDeletingCampaignModalOpen, setIsDeletingCampaignModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberContextMenuOpen, setMemberContextMenuOpen] = useState(false)
  const [isRemovePlayerModalOpen, setIsRemovePlayerModalOpen] = useState(false)
  const [isTransferGMModalOpen, setIsTransferGMModalOpen] = useState(false)
  const copyConfirmationTimeoutRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    // Wait for auth state to be ready
    if (authState.isLoading) return
    loadCampaign()
  }, [campaignSlug, isGuest, authState.isLoading])

  useEffect(() => {
    return () => {
      if (copyConfirmationTimeoutRef.current) {
        clearTimeout(copyConfirmationTimeoutRef.current)
      }
    }
  }, [])

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMemberContextMenuOpen(false)
      }
    }

    if (memberContextMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [memberContextMenuOpen])

  const loadCampaign = async () => {
    // Handle guest user with demo data
    if (isGuest) {
      const guestCampaign = getGuestCampaigns(currentUserId).find(c => c.slug === campaignSlug)
      if (!guestCampaign) {
        navigate('/campaigns')
        return
      }
      const guestMembers = getGuestCampaignMembers(currentUserId)

      setCampaign({
        id: guestCampaign.id,
        slug: guestCampaign.slug,
        name: guestCampaign.name,
        description: guestCampaign.description,
        invite_code: guestCampaign.invite_code,
        created_by: currentUserId,
        streak_count: guestCampaign.streak_count ?? 0,
        streak_cadence: guestCampaign.streak_cadence ?? 'weekly',
      })
      setCampaignName(guestCampaign.name)
      setCampaignDescription(guestCampaign.description)
      setCampaignStreakCadence(guestCampaign.streak_cadence ?? 'weekly')
      setPartyMembers(guestMembers)
      setSessions(getGuestSessionsForCampaign(guestCampaign.id))
      setLoading(false)
      return
    }

    try {
      const client = requireSupabase()
      const { data: campaignData, error: campaignError } = await client
        .from('campaigns')
        .select('id, slug, name, description, invite_code, created_by, streak_count, streak_cadence')
        .eq('slug', campaignSlug)
        .single()

      if (campaignError || !campaignData) {
        navigate('/')
        return
      }

      setCampaign(campaignData)
      setCampaignName(campaignData.name || '')
      setCampaignDescription(campaignData.description || '')
      setCampaignStreakCadence(campaignData.streak_cadence || 'weekly')

      const { data: membersData, error: membersError } = await client.rpc('get_campaign_members', {
        p_campaign_id: campaignData.id,
      })
      if (membersError) {
        const message = String(membersError.message || '')
        if (message.includes('Could not find the function public.get_campaign_members')) {
          setErrorMessage('Party Members is unavailable until migration 0006_campaign_members_rpc.sql is applied in Supabase.')
          setPartyMembers([])
        } else {
          throw membersError
        }
      } else {
        // Fetch user colors for all members
        const memberIds = membersData?.map(m => m.user_id) || []
        if (memberIds.length > 0) {
          try {
            const { data: colorData, error: colorError } = await client.rpc('get_user_colors', {
              user_ids: memberIds
            })

            if (colorError) {
              console.warn('Could not fetch user colors:', colorError.message)
              // Sort members with GM first
              const sorted = (membersData || []).sort((a, b) => {
                if (a.user_id === campaignData.created_by) return -1
                if (b.user_id === campaignData.created_by) return 1
                return 0
              })
              setPartyMembers(sorted)
            } else {
              const colorMap = new Map()
              colorData?.forEach(item => {
                colorMap.set(item.user_id, item.editor_color)
              })

              // Add color to members
              const membersWithColor = membersData.map(member => ({
                ...member,
                color: colorMap.get(member.user_id)
              }))

              // Sort members with GM first
              membersWithColor.sort((a, b) => {
                if (a.user_id === campaignData.created_by) return -1
                if (b.user_id === campaignData.created_by) return 1
                return 0
              })

              setPartyMembers(membersWithColor)
            }
          } catch (err) {
            console.debug('Error fetching colors:', err.message)
            // Sort members with GM first
            const sorted = (membersData || []).sort((a, b) => {
              if (a.user_id === campaignData.created_by) return -1
              if (b.user_id === campaignData.created_by) return 1
              return 0
            })
            setPartyMembers(sorted)
          }
        } else {
          setPartyMembers(membersData || [])
        }
      }

      const { data: sessionsData, error: sessionsError } = await client
        .from('sessions')
        .select('id, slug, name, session_date, archived, created_at')
        .eq('campaign_id', campaignData.id)
        .order('created_at', { ascending: false })

      if (sessionsError) throw sessionsError
      setSessions(sessionsData || [])
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSession = async (e) => {
    e.preventDefault()

    try {
      // Validate inputs before database operation
      const validated = validateCreateSession({
        name: sessionName,
        sessionDate: sessionDate || undefined,
        campaignId: campaign.id
      })

      if (isGuest) {
        createGuestSession(campaign.id, {
          name: validated.name,
          sessionDate: validated.sessionDate || null,
          slug: createUrlSlug(validated.name),
        })
      } else {
        const { error } = await requireSupabase().from('sessions').insert([
          {
            campaign_id: validated.campaignId,
            name: validated.name,
            slug: createUrlSlug(validated.name),
            session_date: validated.sessionDate || null,
          },
        ])

        if (error) throw error
      }

      setShowCreateSession(false)
      setSessionName('')
      setSessionDate('')
      loadCampaign()
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrorMessage(error.getClientMessage())
      } else {
        setErrorMessage(error.message || 'Failed to create session')
      }
    }
  }

  const handleSaveCampaign = async (e) => {
    e.preventDefault()

    try {
      // Validate inputs before database operation
      const validated = validateUpdateCampaign({
        name: campaignName,
        description: campaignDescription,
        streakCadence: campaignStreakCadence,
      })
      const validatedId = validateCampaignId(campaign.id)

      setCampaignSaving(true)
      setErrorMessage('')
      const { data: updatedCampaignData, error } = await requireSupabase().rpc('update_campaign_as_gm_with_streak', {
        p_campaign_id: validatedId,
        p_name: validated.name,
        p_description: validated.description,
        p_streak_cadence: validated.streakCadence,
      })

      if (error) throw error
      const updatedCampaign = Array.isArray(updatedCampaignData) ? updatedCampaignData[0] : updatedCampaignData
      if (!updatedCampaign) {
        throw new Error('Only the GM can edit this campaign.')
      }
      setCampaign((previousCampaign) => ({ ...previousCampaign, ...updatedCampaign }))
      setCampaignName(updatedCampaign.name || '')
      setCampaignDescription(updatedCampaign.description || '')
      setCampaignStreakCadence(updatedCampaign.streak_cadence || 'weekly')
      setEditingCampaign(false)
      await loadCampaign()
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrorMessage(error.getClientMessage())
      } else {
        const message = String(error.message || '')
        if (message.includes('Could not find the function public.update_campaign_as_gm_with_streak')) {
          setErrorMessage('Campaign edit helper is unavailable until migration 20260405_campaign_streak_cadence_rpc.sql is applied in Supabase.')
        } else if (message.toLowerCase().includes('row-level security')) {
          setErrorMessage('Only the GM can edit this campaign.')
        } else {
          setErrorMessage(message || 'Failed to update campaign')
        }
      }
    } finally {
      setCampaignSaving(false)
    }
  }

  const handleDeleteCampaign = () => {
    setIsDeletingCampaignModalOpen(true)
  }

  const handleToggleEditCampaign = () => {
    if (!editingCampaign && campaign) {
      setCampaignName(campaign.name || '')
      setCampaignDescription(campaign.description || '')
      setCampaignStreakCadence(campaign.streak_cadence || 'weekly')
    }
    setEditingCampaign((prev) => !prev)
  }

  const handleConfirmDeleteCampaign = async () => {
    try {
      const { error } = await requireSupabase().from('campaigns').delete().eq('id', campaign.id)
      if (error) throw error
      setIsDeletingCampaignModalOpen(false)
      navigate('/')
    } catch (error) {
      const message = String(error.message || '')
      if (message.toLowerCase().includes('row-level security')) {
        setErrorMessage('Only the GM can delete this campaign.')
      } else {
        setErrorMessage(message || 'Failed to delete campaign')
      }
    }
  }

  const toggleArchive = async (session) => {
    try {
      const { error } = await requireSupabase()
        .from('sessions')
        .update({ archived: !session.archived })
        .eq('id', session.id)
      if (error) throw error
      loadCampaign()
    } catch (error) {
      setErrorMessage(error.message || 'Failed to archive session')
    }
  }

  const openEditSessionModal = (session) => {
    setEditingSession(session)
    setIsEditSessionModalOpen(true)
  }

  const handleSaveSession = async (sessionId, updates) => {
    try {
      const client = requireSupabase()

      const { data, error } = await client
        .from('sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()

      if (error) {
        console.error('Session update error:', error)
        throw error
      }

      if (!data || data.length === 0) {
        console.error('Update returned 0 rows - RLS is blocking UPDATE even though SELECT works')
        return
      }

      setEditingSession(null)
      setIsEditSessionModalOpen(false)
      await loadCampaign()
    } catch (error) {
      console.error('Failed to save session:', error)
      throw error
    }
  }

  const handleDeleteSession = (session) => {
    setSessionToDelete(session)
    setIsDeleteSessionModalOpen(true)
  }

  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete) return

    try {
      setDeletingSessionId(sessionToDelete.id)
      const { error } = await requireSupabase().from('sessions').delete().eq('id', sessionToDelete.id)
      if (error) throw error
      setSessions((currentSessions) => currentSessions.filter((item) => item.id !== sessionToDelete.id))
      if (editingSession?.id === sessionToDelete.id) {
        setEditingSession(null)
        setIsEditSessionModalOpen(false)
      }
      setIsDeleteSessionModalOpen(false)
      setSessionToDelete(null)
    } catch (error) {
      const message = String(error.message || '')
      if (message.toLowerCase().includes('row-level security')) {
        setErrorMessage('Only the GM can delete this session.')
      } else {
        setErrorMessage(message || 'Failed to delete session')
      }
    } finally {
      setDeletingSessionId(null)
    }
  }

  const copyInviteLink = async () => {
    if (!campaign?.invite_code) return
    const link = `${window.location.origin}/join/${campaign.invite_code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopyConfirmation(`Invite link copied: ${campaign.invite_code}`)
      if (copyConfirmationTimeoutRef.current) {
        clearTimeout(copyConfirmationTimeoutRef.current)
      }
      copyConfirmationTimeoutRef.current = setTimeout(() => {
        setCopyConfirmation('')
        copyConfirmationTimeoutRef.current = null
      }, 2000)
    } catch (error) {
      setErrorMessage(error.message || 'Failed to copy invite link')
    }
  }

  const handleOpenPartyMemberMenu = (member) => {
    setSelectedMember(member)
    setMemberContextMenuOpen(true)
  }

  const handleOpenRemovePlayerModal = () => {
    setMemberContextMenuOpen(false)
    setIsRemovePlayerModalOpen(true)
  }

  const handleOpenTransferGMModal = () => {
    setMemberContextMenuOpen(false)
    setIsTransferGMModalOpen(true)
  }

  const handleRemovePlayerFromCampaign = async (userId) => {
    try {
      const client = requireSupabase()
      const { data, error } = await client.rpc('remove_campaign_member', {
        p_campaign_id: campaign.id,
        p_user_id: userId
      })

      if (error) {
        console.error('Error removing player:', error)
        throw error
      }

      console.log('Player removed successfully:', { userId, campaignId: campaign.id })
      setPartyMembers(partyMembers.filter(m => m.user_id !== userId))
      setErrorMessage('')
    } catch (error) {
      console.error('Failed to remove player:', error)
      setErrorMessage(error.message || 'Failed to remove player from campaign')
      throw error
    }
  }

  const handleTransferGMStatus = async (userId) => {
    try {
      const client = requireSupabase()
      const { data, error } = await client
        .from('campaigns')
        .update({ created_by: userId })
        .eq('id', campaign.id)

      if (error) {
        console.error('Error transferring GM:', error)
        throw error
      }

      console.log('GM status transferred successfully:', { userId, campaignId: campaign.id })
      setCampaign({ ...campaign, created_by: userId })
      setErrorMessage('')
    } catch (error) {
      console.error('Failed to transfer GM status:', error)
      setErrorMessage(error.message || 'Failed to transfer GM status')
      throw error
    }
  }

  const visibleSessions = sessions.filter((session) => (showArchived ? true : !session.archived))
  const isGM = Boolean(campaign && currentUserId && campaign.created_by === currentUserId)
  const campaignStreakText = formatCampaignStreak(campaign)
  const campaignStreakCount = campaign?.streak_count ?? 0

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500 dark:text-gray-400">Loading campaign...</p>
      </div>
    )
  }

  return (
    <div className="pb-12">
      {/* Header Section */}
      <div className="mb-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="flex flex-col gap-4">

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <svg className="w-6 h-6 text-slate-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-gray-100 break-all">{campaign.name}</h1>

              {isGM && (
                <span className="inline-flex items-center rounded-md bg-brand-50 dark:bg-brand-900/30 px-2 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 ring-1 ring-inset ring-brand-700/10 shrink-0">
                  GM
                </span>
              )}
              {campaignStreakText && (
                <span
                  className="inline-flex items-center ml-2 gap-1 text-amber-700 dark:text-amber-300"
                  title={campaignStreakText}
                  aria-label={campaignStreakText}
                >
                  <img src="/icons/streak.png" alt="" className="h-7 w-7 shrink-0" aria-hidden="true" />
                  <span className="text-base font-semibold leading-none">{campaignStreakCount}</span>
                </span>
              )}
            </div>

            {campaign.description && (
              <p className="mt-2 text-slate-500 dark:text-gray-400 max-w-2xl text-sm md:text-base">{campaign.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={copyInviteLink}
                className="flex-1 sm:flex-none bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Invite
              </Button>
              {isGM && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleToggleEditCampaign}
                    className="bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                  >
                    {editingCampaign ? 'Cancel Edit' : 'Edit'}
                  </Button>
                  <Button
                    variant="danger"
                    className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 border-red-200 dark:border-red-900/50"
                    onClick={handleDeleteCampaign}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          <Card className="p-0">
            <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-gray-100">Party Members</h3>
              <span className="bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 text-xs font-medium px-2 py-0.5 rounded-full">
                {partyMembers.length}
              </span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-gray-700/50">
              {partyMembers.length > 0 ? (
                partyMembers.map((member) => (
                  <li
                    key={member.user_id}
                    onClick={() => isGM && member.user_id !== currentUserId && handleOpenPartyMemberMenu(member)}
                    className={`p-3 flex items-center gap-3 transition-colors relative ${isGM && member.user_id !== currentUserId ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/50' : 'cursor-default'}`}
                  >
                    <div
                      className="size-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: member.color || colorFromString(member.display_name) }}
                    >
                      {member.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">
                        {member.display_name}
                      </p>
                      {campaign && member.user_id === campaign.created_by && (
                        <p className="text-xs text-slate-500 dark:text-gray-400">Game Master</p>
                      )}
                    </div>

                    {/* Context Menu */}
                    {isGM && member.user_id !== currentUserId && selectedMember?.user_id === member.user_id && memberContextMenuOpen && (
                      <div ref={menuRef} className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50 py-1 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenTransferGMModal()
                          }}
                          className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700"
                        >
                          Transfer GM Status
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenRemovePlayerModal()
                          }}
                          className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-gray-700"
                        >
                          Remove from Campaign
                        </button>
                      </div>
                    )}
                  </li>
                ))
              ) : (
                <li className="p-4 text-sm text-slate-500 dark:text-gray-400 text-center">
                  No party members yet.
                </li>
              )}
            </ul>
            <div className="p-3 bg-slate-50 dark:bg-gray-800/50 border-t border-slate-100 dark:border-gray-700">
              <Button
                onClick={copyInviteLink}
                variant="outline"
                className="w-full justify-center text-sm border-dashed"
              >
                + Invite Player
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-sm font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {isGM && editingCampaign && (
        <Card className="mb-8 animate-fadeIn">
          <div className="p-6 border-b border-slate-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">Edit Campaign</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleSaveCampaign} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Campaign Name</label>
                <Input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  required
                  className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={campaignDescription}
                  onChange={(e) => setCampaignDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder-slate-400 dark:placeholder-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Streak Cadence</label>
                <select
                  value={campaignStreakCadence}
                  onChange={(e) => setCampaignStreakCadence(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCampaignName(campaign?.name || '')
                    setCampaignDescription(campaign?.description || '')
                    setCampaignStreakCadence(campaign?.streak_cadence || 'weekly')
                    setEditingCampaign(false)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-brand-600 text-white hover:bg-brand-700" disabled={campaignSaving}>
                  {campaignSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">Sessions</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
            <label className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 bg-white dark:bg-gray-900 dark:border-gray-600 h-4 w-4"
              />
              <span className="whitespace-nowrap">Show archived</span>
            </label>
            <Button
              onClick={() => setShowCreateSession(!showCreateSession)}
              className="bg-brand-600 text-white hover:bg-brand-700 text-sm px-3 py-1.5 whitespace-nowrap w-full sm:w-auto justify-center"
            >
              + New Session
            </Button>
          </div>
        </div>

        {showCreateSession && (
          <Card className="p-6 mb-6 animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-4">Create New Session</h3>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Session Name</label>
                <Input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., Session 1: The Beginning"
                  required
                  className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Date (Optional)</label>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateSession(false)}
                  className="text-sm"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-brand-600 text-white hover:bg-brand-700 text-sm">
                  Create Session
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="space-y-4">
          {visibleSessions.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg border-dashed ">
              <p className="text-slate-500 dark:text-gray-400">No sessions found.</p>
              <Button
                onClick={() => setShowCreateSession(true)}
                variant="link"
                className="text-brand-600 hover:text-brand-700 dark:text-brand-400 mt-2 "
              >
                Create your first session
              </Button>
            </div>
          ) : (
            visibleSessions.map((session) => (
              <div
                key={session.id}
                className={`
                  group bg-white dark:bg-gray-800 border rounded-lg shadow-sm p-4 transition-all hover:shadow-md
                  ${session.archived ? 'border-slate-100 dark:border-gray-800 opacity-75' : 'border-slate-200 dark:border-gray-700'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-gray-100 text-lg">
                        <button onClick={() => navigate(`/campaigns/${campaign.slug}/sessions/${session.slug}`)} className="hover:underline text-left">
                          {session.name}
                        </button>
                      </h3>
                      {session.archived && (
                        <span className="inline-flex items-center rounded bg-slate-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-slate-800 dark:text-gray-400">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                      {session.session_date ? new Date(session.session_date + 'T00:00:00').toLocaleDateString() : 'No date set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      onClick={() => openEditSessionModal(session)}
                      variant="ghost"
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"
                      title="Edit Session"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Button>
                    <Button
                      onClick={() => toggleArchive(session)}
                      variant="ghost"
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"
                      title={session.archived ? "Unarchive" : "Archive"}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </Button>
                    {isGM && (
                      <Button
                        onClick={() => handleDeleteSession(session)}
                        variant="ghost"
                        className="p-2 text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete Session"
                        disabled={deletingSessionId === session.id}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14" />
                        </svg>
                      </Button>
                    )}
                    <Button
                      onClick={() => navigate(`/campaigns/${campaign.slug}/sessions/${session.slug}`)}
                      className="bg-brand-600 text-white hover:bg-brand-700 text-sm px-3 py-1.5"
                    >
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {copyConfirmation && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full shadow-lg border border-emerald-200 dark:border-emerald-800 font-medium text-sm animate-in fade-in slide-in-from-bottom-4">
          {copyConfirmation}
        </div>
      )}

      <EditSessionModal
        isOpen={isEditSessionModalOpen}
        onClose={() => setIsEditSessionModalOpen(false)}
        onSave={handleSaveSession}
        session={editingSession}
      />

      <DeleteSessionModal
        isOpen={isDeleteSessionModalOpen}
        onClose={() => {
          setIsDeleteSessionModalOpen(false)
          setSessionToDelete(null)
        }}
        onDelete={handleConfirmDeleteSession}
        sessionName={sessionToDelete?.name || ''}
      />

      <DeleteCampaignModal
        isOpen={isDeletingCampaignModalOpen}
        onClose={() => setIsDeletingCampaignModalOpen(false)}
        onDelete={handleConfirmDeleteCampaign}
        campaignName={campaignName}
      />

      <RemovePlayerModal
        isOpen={isRemovePlayerModalOpen}
        onClose={() => {
          setIsRemovePlayerModalOpen(false)
          setSelectedMember(null)
        }}
        onConfirm={() => handleRemovePlayerFromCampaign(selectedMember.user_id)}
        playerName={selectedMember?.display_name || ''}
      />

      <TransferGMModal
        isOpen={isTransferGMModalOpen}
        onClose={() => {
          setIsTransferGMModalOpen(false)
          setSelectedMember(null)
        }}
        onConfirm={() => handleTransferGMStatus(selectedMember.user_id)}
        playerName={selectedMember?.display_name || ''}
      />
    </div>
  )
}

export default CampaignDetail
