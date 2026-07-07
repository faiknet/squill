import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../lib/supabase'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useMobileMenu } from '../contexts/MobileMenuContext'
import { Button, Card, Input, LoadingSpinner } from '../components/ui'
import { EditSessionModal, DeleteSessionModal } from '../components/sessions'
import { colorFromString } from '../lib/liveblocks'
import { createUrlSlug } from '../lib/utils'
import DeleteCampaignModal from '../components/campaigns/DeleteCampaignModal'
import StreakInfoModal from '../components/campaigns/StreakInfoModal'
import RemovePlayerModal from '../components/campaigns/RemovePlayerModal'
import TransferGMModal from '../components/campaigns/TransferGMModal'
import LeaveCampaignModal from '../components/campaigns/LeaveCampaignModal'
import GMLeaveWarningModal from '../components/campaigns/GMLeaveWarningModal'
import {
  validateUpdateCampaign,
  validateCreateSession,
  validateCampaignId,
  validateCampaignName,
  ValidationError,
} from '../lib/validation'
import {
  GUEST_CAMPAIGN_SLUG,
  createGuestSession,
  getGuestSessionsForCampaign,
} from '../lib/guestData'
import { useCampaignDetail, sortMembersWithGmFirst } from '../hooks/useCampaigns'

const STREAK_PERIOD_LABELS = {
  weekly: 'week',
  biweekly: 'biweekly',
  monthly: 'month',
}

function getCadenceDays(cadence) {
  if (cadence === 'biweekly') return 14
  if (cadence === 'monthly') return 28
  return 7
}

function getPeriodStart(dateStr, cadence) {
  const date = new Date(`${dateStr}T00:00:00.000Z`)
  const anchor = new Date('1970-01-05T00:00:00.000Z')
  const dayMs = 24 * 60 * 60 * 1000
  const periodDays = getCadenceDays(cadence)
  const offsetDays = Math.floor((date.getTime() - anchor.getTime()) / dayMs)
  const periodOffset = Math.floor(offsetDays / periodDays) * periodDays
  return new Date(anchor.getTime() + periodOffset * dayMs)
}

function getNextPeriodStart(periodStartDate, cadence) {
  const next = new Date(periodStartDate.getTime())
  next.setUTCDate(next.getUTCDate() + getCadenceDays(cadence))
  return next
}

function getActiveStreakCount(campaign) {
  if (!campaign || !campaign.streak_count) return 0
  const cadence = campaign.streak_cadence || 'weekly'
  const lastPeriod = campaign.streak_last_period_start
  if (!lastPeriod) return 0

  const today = new Date().toISOString().split('T')[0]
  const currentPeriodStart = getPeriodStart(today, cadence)
  const lastPeriodStart = getPeriodStart(lastPeriod, cadence)
  const isExpired = getNextPeriodStart(lastPeriodStart, cadence).getTime() < currentPeriodStart.getTime()
  
  return isExpired ? 0 : campaign.streak_count
}

function formatCampaignStreak(campaign) {
  const streakCount = getActiveStreakCount(campaign)
  if (streakCount <= 0) return ''
  const cadence = campaign.streak_cadence || 'weekly'
  const periodLabel = STREAK_PERIOD_LABELS[cadence] || STREAK_PERIOD_LABELS.weekly
  return `${streakCount} ${periodLabel} streak`
}

function CampaignDetail() {
  const { campaignSlug } = useParams()
  const navigate = useNavigate()
  const { authState } = useAuth()
  const queryClient = useQueryClient()

  const { isGuest } = authState
  const { setMobileMenuOpen } = useMobileMenu()
  const currentUserId = authState.user?.id ?? null

  // React Query — replaces useState + loadCampaign useEffect
  const {
    data: campaignDetailData,
    isLoading: campaignIsLoading,
    error: campaignDetailError,
  } = useCampaignDetail(campaignSlug)

  // Include authState.isLoading: while auth resolves the query is disabled
  // (isLoading=false) but campaign is still null — must show spinner.
  const loading = authState.isLoading || campaignIsLoading

  const campaign = campaignDetailData?.campaign ?? null
  const sessions = campaignDetailData?.sessions ?? []
  const partyMembers = campaignDetailData?.partyMembers ?? []

  // Helper to patch the cached data without triggering a refetch
  const updateCampaignCache = (updater) => {
    queryClient.setQueryData(
      ['campaign-detail', campaignSlug, currentUserId],
      (old) => old ? { ...old, ...updater(old) } : old
    )
  }

  useEffect(() => {
    document.title = campaign ? `${campaign.name} — Squill` : 'Campaign — Squill'
  }, [campaign])

  const [isEditingName, setIsEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [draftDescription, setDraftDescription] = useState('')
  const [campaignSaving, setCampaignSaving] = useState(false)
  const [showCreateSession, setShowCreateSession] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [showArchived, setShowArchived] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [copyConfirmation, setCopyConfirmation] = useState('')
  const [editingSession, setEditingSession] = useState(null)
  const [isPartyCollapsed, setIsPartyCollapsed] = useState(() => localStorage.getItem('party_collapsed') === 'true')
  const [menuSession, setMenuSession] = useState(null)
  const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState(null)
  const [isDeleteSessionModalOpen, setIsDeleteSessionModalOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [isDeletingCampaignModalOpen, setIsDeletingCampaignModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberContextMenuOpen, setMemberContextMenuOpen] = useState(false)
  const [isRemovePlayerModalOpen, setIsRemovePlayerModalOpen] = useState(false)
  const [isTransferGMModalOpen, setIsTransferGMModalOpen] = useState(false)
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false)
  const [isLeaveCampaignModalOpen, setIsLeaveCampaignModalOpen] = useState(false)
  const [isGMLeaveWarningModalOpen, setIsGMLeaveWarningModalOpen] = useState(false)
  const copyConfirmationTimeoutRef = useRef(null)
  const menuRef = useRef(null)

  // Navigate away if campaign not found
  useEffect(() => {
    if (campaignDetailError?.code === 'NOT_FOUND') {
      navigate('/campaigns')
    }
  }, [campaignDetailError, navigate])

  // Show non-critical members error inline
  useEffect(() => {
    if (campaignDetailData?.membersError) {
      setErrorMessage(campaignDetailData.membersError)
    }
  }, [campaignDetailData?.membersError])

  // Show critical campaign loading error if not NOT_FOUND
  useEffect(() => {
    if (campaignDetailError && campaignDetailError.code !== 'NOT_FOUND') {
      setErrorMessage(campaignDetailError.message || 'Failed to load campaign')
    }
  }, [campaignDetailError])

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
        const refreshedSessions = getGuestSessionsForCampaign(campaign.id)
        updateCampaignCache(() => ({ sessions: refreshedSessions }))
      } else {
        const { data: newSession, error } = await requireSupabase().from('sessions').insert([
          {
            campaign_id: validated.campaignId,
            name: validated.name,
            slug: createUrlSlug(validated.name),
            session_date: validated.sessionDate || null,
          },
        ]).select('id, slug, name, session_date, archived, created_at').single()

        if (error) throw error
        if (newSession) {
          updateCampaignCache(old => ({ sessions: [newSession, ...old.sessions] }))
        }
      }

      setShowCreateSession(false)
      setSessionName('')
      setSessionDate('')
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrorMessage(error.getClientMessage())
      } else {
        setErrorMessage(error.message || 'Failed to create session')
      }
    }
  }

  const handleSaveName = async (newName) => {
    try {
      const validatedName = validateCampaignName(newName)
      setCampaignSaving(true)
      setErrorMessage('')

      if (isGuest) {
        const stored = sessionStorage.getItem('squill_guest_campaigns')
        if (stored) {
          const campaigns = JSON.parse(stored)
          const updatedCampaigns = campaigns.map(c =>
            c.id === campaign.id ? { ...c, name: validatedName } : c
          )
          sessionStorage.setItem('squill_guest_campaigns', JSON.stringify(updatedCampaigns))
        }
        updateCampaignCache(old => ({ campaign: { ...old.campaign, name: validatedName } }))
        setIsEditingName(false)
      } else {
        const validatedId = validateCampaignId(campaign.id)
        const { data: updatedCampaignData, error } = await requireSupabase().rpc('update_campaign_as_gm_with_streak', {
          p_campaign_id: validatedId,
          p_name: validatedName,
          p_description: campaign.description,
          p_streak_cadence: campaign.streak_cadence || 'weekly',
          p_label_campaign: campaign.label_campaign || 'Campaign',
          p_label_session: campaign.label_session || 'Session',
          p_label_member: campaign.label_member || 'Players',
          p_label_gm: campaign.label_gm || 'GM',
        })

        if (error) throw error
        const updatedCampaign = Array.isArray(updatedCampaignData) ? updatedCampaignData[0] : updatedCampaignData
        if (!updatedCampaign) throw new Error('Only the GM can edit this campaign.')
        updateCampaignCache(old => ({ campaign: { ...old.campaign, ...updatedCampaign } }))
        setIsEditingName(false)
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrorMessage(error.getClientMessage())
      } else {
        const message = String(error.message || '')
        if (message.toLowerCase().includes('row-level security')) {
          setErrorMessage('Only the GM can edit this campaign.')
        } else {
          setErrorMessage('Failed to update campaign name. Please try again.')
        }
      }
    } finally {
      setCampaignSaving(false)
    }
  }

  const handleSaveDescription = async (newDescription) => {
    try {
      const validated = validateUpdateCampaign({ description: newDescription })
      setCampaignSaving(true)
      setErrorMessage('')

      if (isGuest) {
        const stored = sessionStorage.getItem('squill_guest_campaigns')
        if (stored) {
          const campaigns = JSON.parse(stored)
          const updatedCampaigns = campaigns.map(c =>
            c.id === campaign.id ? { ...c, description: validated.description || '' } : c
          )
          sessionStorage.setItem('squill_guest_campaigns', JSON.stringify(updatedCampaigns))
        }
        updateCampaignCache(old => ({ campaign: { ...old.campaign, description: validated.description || '' } }))
        setIsEditingDescription(false)
      } else {
        const validatedId = validateCampaignId(campaign.id)
        const { data: updatedCampaignData, error } = await requireSupabase().rpc('update_campaign_as_gm_with_streak', {
          p_campaign_id: validatedId,
          p_name: campaign.name,
          p_description: validated.description || '',
          p_streak_cadence: campaign.streak_cadence || 'weekly',
          p_label_campaign: campaign.label_campaign || 'Campaign',
          p_label_session: campaign.label_session || 'Session',
          p_label_member: campaign.label_member || 'Players',
          p_label_gm: campaign.label_gm || 'GM',
        })

        if (error) throw error
        const updatedCampaign = Array.isArray(updatedCampaignData) ? updatedCampaignData[0] : updatedCampaignData
        if (!updatedCampaign) throw new Error('Only the GM can edit this campaign.')
        updateCampaignCache(old => ({ campaign: { ...old.campaign, ...updatedCampaign } }))
        setIsEditingDescription(false)
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrorMessage(error.getClientMessage())
      } else {
        const message = String(error.message || '')
        if (message.toLowerCase().includes('row-level security')) {
          setErrorMessage('Only the GM can edit this campaign.')
        } else {
          setErrorMessage('Failed to update campaign description. Please try again.')
        }
      }
    } finally {
      setCampaignSaving(false)
    }
  }

  const handleDeleteCampaign = () => {
    setIsDeletingCampaignModalOpen(true)
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
      updateCampaignCache(old => ({
        sessions: old.sessions.map(s =>
          s.id === session.id ? { ...s, archived: !session.archived } : s
        )
      }))
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

      const updated = data[0]
      if (updated) {
        updateCampaignCache(old => ({
          sessions: old.sessions.map(s => s.id === sessionId ? { ...s, ...updated } : s)
        }))
      }
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
      updateCampaignCache(old => ({
        sessions: old.sessions.filter(s => s.id !== sessionToDelete.id)
      }))
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
      setCopyConfirmation('Invite link copied!')
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
      const { error } = await client.rpc('remove_campaign_member', {
        p_campaign_id: campaign.id,
        p_user_id: userId
      })

      if (error) {
        console.error('Error removing player:', error)
        throw error
      }

      updateCampaignCache(old => ({
        partyMembers: old.partyMembers.filter(m => m.user_id !== userId)
      }))
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
      const { error } = await client
        .from('campaigns')
        .update({ created_by: userId })
        .eq('id', campaign.id)

      if (error) {
        console.error('Error transferring GM:', error)
        throw error
      }

      updateCampaignCache(old => ({
        campaign: { ...old.campaign, created_by: userId },
        partyMembers: sortMembersWithGmFirst(old.partyMembers, userId),
      }))
      setErrorMessage('')
    } catch (error) {
      console.error('Failed to transfer GM status:', error)
      setErrorMessage(error.message || 'Failed to transfer GM status')
      throw error
    }
  }

  const handleLeaveCampaign = async () => {
    try {
      const client = requireSupabase()
      const { error } = await client
        .from('campaign_members')
        .delete()
        .eq('campaign_id', campaign.id)
        .eq('user_id', currentUserId)
      if (error) throw error
      navigate('/campaigns')
    } catch (error) {
      setErrorMessage(error.message || 'Failed to leave campaign')
    }
  }

  const visibleSessions = sessions.filter((session) => (showArchived ? true : !session.archived))
  const isGM = Boolean(campaign && currentUserId && campaign.created_by === currentUserId)
  const campaignStreakText = formatCampaignStreak(campaign)
  const campaignStreakCount = getActiveStreakCount(campaign)

  const campaignLabel = campaign?.label_campaign || 'Campaign'
  const sessionLabel = campaign?.label_session || 'Session'
  const memberLabel = campaign?.label_member || 'Players'
  const gmLabel = campaign?.label_gm || 'GM'
  const singularMember = memberLabel === 'Members' ? 'Member' : memberLabel === 'Editors' ? 'Editor' : memberLabel === 'Collaborators' ? 'Collaborator' : 'Player'

  if (loading) {
    return <LoadingSpinner fullPage={false} />
  }

  if (!campaign) {
    return (
      <div className="p-4 md:p-6 max-w-xl mx-auto mt-8">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 flex flex-col gap-4">
          <h2 className="text-lg font-bold">Failed to load campaign</h2>
          <p className="text-sm text-slate-600 dark:text-gray-300">{errorMessage || 'An error occurred while loading this campaign.'}</p>
          <Button onClick={() => navigate('/campaigns')} className="w-fit bg-brand-600 text-white hover:bg-brand-700">
            Back to Campaigns
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-12">
      {/* Header Section */}
      <div className="mb-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="flex flex-col gap-4">

            {isEditingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSaveName(draftName)
                }}
                className="flex items-center gap-2 w-full max-w-md"
              >
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 py-1"
                  autoFocus
                  required
                />
                <Button
                  size="sm"
                  type="submit"
                  disabled={campaignSaving}
                  className="bg-brand-600 text-white hover:bg-brand-700 shrink-0"
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingName(false)}
                  disabled={campaignSaving}
                  className="shrink-0"
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-md transition-colors shrink-0"
                >
                  <svg className="w-6 h-6 text-slate-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-gray-100 truncate">{campaign.name}</h1>
                {isGM && (
                  <button
                    onClick={() => {
                      setDraftName(campaign.name)
                      setIsEditingName(true)
                    }}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-gray-700/50 rounded-md transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 shrink-0"
                    aria-label="Edit campaign name"
                    title="Edit campaign name"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}

                {isGM && (
                  <span className="inline-flex items-center rounded-md bg-brand-50 dark:bg-brand-900/30 px-2 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 ring-1 ring-inset ring-brand-700/10 shrink-0">
                    {gmLabel}
                  </span>
                )}
                {campaignStreakText && (
                  <button
                    type="button"
                    onClick={() => setIsStreakModalOpen(true)}
                    className="inline-flex items-center ml-2 gap-1 text-amber-700 dark:text-amber-300 hover:opacity-80 transition-opacity cursor-pointer"
                    title={campaignStreakText}
                    aria-label={campaignStreakText}
                  >
                    <img src="/icons/streak.png" alt="" className="h-7 w-7 shrink-0" aria-hidden="true" loading="lazy" />
                    <span className="text-base font-semibold leading-none">{campaignStreakCount}</span>
                  </button>
                )}
              </div>
            )}

            {isEditingDescription ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSaveDescription(draftDescription)
                }}
                className="mt-2 space-y-2 max-w-2xl"
              >
                <textarea
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder-slate-400 dark:placeholder-gray-600"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    type="submit"
                    disabled={campaignSaving}
                    className="bg-brand-600 text-white hover:bg-brand-700"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingDescription(false)}
                    disabled={campaignSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              campaign.description ? (
                <p className="mt-2 text-slate-500 dark:text-gray-400 max-w-2xl text-sm md:text-base">
                  {campaign.description}
                  {isGM && (
                    <button
                      onClick={() => {
                        setDraftDescription(campaign.description)
                        setIsEditingDescription(true)
                      }}
                      className="inline-flex ml-2 align-middle p-1 hover:bg-slate-100 dark:hover:bg-gray-700/50 rounded-md transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
                      aria-label="Edit campaign description"
                      title="Edit campaign description"
                    >
                      <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </p>
              ) : (
                isGM && (
                  <button
                    onClick={() => {
                      setDraftDescription('')
                      setIsEditingDescription(true)
                    }}
                    className="mt-2 text-sm text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors flex items-center gap-1.5 w-max"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>Add description</span>
                  </button>
                )
              )
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <Button
                variant="outline"
                onClick={copyInviteLink}
                className="shrink-0 whitespace-nowrap bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                <svg className="w-4 h-4 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Invite
              </Button>
              {isGM && (
                <>
                  {!isGuest && (
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/campaigns/${campaign.slug}/settings`)}
                      className="shrink-0 p-2 bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
                      aria-label="Campaign Settings"
                      title="Campaign Settings"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    className="shrink-0 whitespace-nowrap bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 border-red-200 dark:border-red-900/50"
                    onClick={handleDeleteCampaign}
                  >
                    Delete
                  </Button>
                </>
              )}
              <Button
                variant="danger"
                className="shrink-0 whitespace-nowrap bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 border-red-200 dark:border-red-900/50"
                onClick={() => {
                  if (isGM) {
                    setIsGMLeaveWarningModalOpen(true)
                  } else {
                    setIsLeaveCampaignModalOpen(true)
                  }
                }}
              >
                Leave
              </Button>
            </div>
          </div>

          <Card className="p-0 overflow-hidden">
            <button
              onClick={() => {
                const nextVal = !isPartyCollapsed
                setIsPartyCollapsed(nextVal)
                localStorage.setItem('party_collapsed', String(nextVal))
              }}
              className="w-full p-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors text-left"
              aria-expanded={!isPartyCollapsed}
            >
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-gray-100">{memberLabel}</h3>
                <span className="bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 text-xs font-medium px-2 py-0.5 rounded-full">
                  {partyMembers.length}
                </span>
              </div>
              <svg 
                className={`w-4 h-4 text-slate-400 dark:text-gray-400 transition-transform duration-200 ${isPartyCollapsed ? '-rotate-90' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {!isPartyCollapsed && (
              <>
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
                            <p className="text-xs text-slate-500 dark:text-gray-400">{gmLabel}</p>
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
                              Transfer {gmLabel} Status
                            </button>
                            <button
                              onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenRemovePlayerModal()
                              }}
                              className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-gray-700"
                            >
                              Remove from {campaignLabel}
                            </button>
                          </div>
                        )}
                      </li>
                    ))
                  ) : (
                    <li className="p-4 text-sm text-slate-500 dark:text-gray-400 text-center">
                      No {memberLabel.toLowerCase()} yet.
                    </li>
                  )}
                </ul>
                <div className="p-3 bg-slate-50 dark:bg-gray-800/50 border-t border-slate-100 dark:border-gray-700">
                  <Button
                    onClick={copyInviteLink}
                    variant="outline"
                    className="w-full justify-center text-sm border-dashed"
                  >
                    + Invite {singularMember}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 flex items-center justify-between" role="alert">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-sm font-bold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">{sessionLabel}s</h2>
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
              + New {sessionLabel}
            </Button>
          </div>
        </div>

        {showCreateSession && (
          <Card className="p-6 mb-6 animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-4">Create New {sessionLabel}</h3>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label htmlFor="session-name" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">{sessionLabel} Name</label>
                <Input
                  id="session-name"
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder={`e.g., ${sessionLabel} 1: The Beginning`}
                  required
                  className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label htmlFor="session-date" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Date (Optional)</label>
                <Input
                  id="session-date"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700"
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
                  Create {sessionLabel}
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="space-y-4">
          {visibleSessions.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg border-dashed ">
              <p className="text-slate-500 dark:text-gray-400">No {sessionLabel.toLowerCase()}s found.</p>
              <Button
                onClick={() => setShowCreateSession(true)}
                variant="link"
                className="text-brand-600 hover:text-brand-700 dark:text-brand-400 mt-2 "
              >
                Create your first {sessionLabel.toLowerCase()}
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
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 dark:text-gray-100 text-base sm:text-lg truncate">
                        <button onClick={() => navigate(`/campaigns/${campaign.slug}/sessions/${session.slug}`)} className="hover:underline text-left truncate">
                          {session.name}
                        </button>
                      </h3>
                      {session.archived && (
                        <span className="inline-flex items-center rounded bg-slate-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-slate-800 dark:text-gray-400 shrink-0">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                      {session.session_date ? new Date(session.session_date + 'T00:00:00').toLocaleDateString() : 'No date set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Desktop Actions */}
                    <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    </div>
                    {/* Mobile Menu Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuSession(session) }}
                      className="sm:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-full transition-colors shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    <Button
                      onClick={() => navigate(`/campaigns/${campaign.slug}/sessions/${session.slug}`)}
                      className="bg-brand-600 text-white hover:bg-brand-700 text-sm px-3 py-1.5 rounded shrink-0"
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

      {/* Session Actions Sheet Modal for Mobile */}
      {menuSession && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60" onClick={() => setMenuSession(null)}>
          <div 
            className="w-full sm:max-w-sm bg-white dark:bg-gray-800 rounded-t-xl sm:rounded-xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700 flex justify-between items-center">
              <span className="font-semibold text-slate-800 dark:text-gray-200 truncate">{menuSession.name}</span>
              <button onClick={() => setMenuSession(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-full">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="py-1">
              <button
                onClick={() => { openEditSessionModal(menuSession); setMenuSession(null) }}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 flex items-center gap-3 text-sm text-slate-700 dark:text-gray-300"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit details
              </button>
              <button
                onClick={() => { toggleArchive(menuSession); setMenuSession(null) }}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 flex items-center gap-3 text-sm text-slate-700 dark:text-gray-300"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {menuSession.archived ? 'Unarchive' : 'Archive'}
              </button>
              {isGM && (
                <button
                  onClick={() => { handleDeleteSession(menuSession); setMenuSession(null) }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-gray-700/50 flex items-center gap-3 text-sm text-red-600 dark:text-red-400"
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14" />
                  </svg>
                  Delete session
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {copyConfirmation && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full shadow-lg border border-emerald-200 dark:border-emerald-800 font-medium text-sm animate-in fade-in slide-in-from-bottom-4" role="status" aria-live="polite">
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
        campaignName={campaign?.name || ''}
        campaignLabel={campaignLabel}
      />

      <RemovePlayerModal
        isOpen={isRemovePlayerModalOpen}
        onClose={() => {
          setIsRemovePlayerModalOpen(false)
          setSelectedMember(null)
        }}
        onConfirm={() => handleRemovePlayerFromCampaign(selectedMember.user_id)}
        playerName={selectedMember?.display_name || ''}
        memberLabel={singularMember}
        campaignLabel={campaignLabel.toLowerCase()}
      />

      <TransferGMModal
        isOpen={isTransferGMModalOpen}
        onClose={() => {
          setIsTransferGMModalOpen(false)
          setSelectedMember(null)
        }}
        onConfirm={() => handleTransferGMStatus(selectedMember.user_id)}
        playerName={selectedMember?.display_name || ''}
        gmLabel={gmLabel}
        campaignLabel={campaignLabel.toLowerCase()}
      />

      <StreakInfoModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        campaign={campaign}
      />

      <LeaveCampaignModal
        isOpen={isLeaveCampaignModalOpen}
        onClose={() => setIsLeaveCampaignModalOpen(false)}
        onConfirm={handleLeaveCampaign}
        campaignName={campaign?.name || ''}
        campaignLabel={campaignLabel}
      />

      <GMLeaveWarningModal
        isOpen={isGMLeaveWarningModalOpen}
        onClose={() => setIsGMLeaveWarningModalOpen(false)}
      />
    </div>
  )
}

// sortMembersWithGmFirst is now defined in useCampaigns.js and imported above

import { memo } from 'react'
export default memo(CampaignDetail)
