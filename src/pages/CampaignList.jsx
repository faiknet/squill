import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef, memo } from 'react'
import { requireSupabase } from '../lib/supabase'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useFormState } from '../hooks/useFormState'
import { copyInviteLink, getDisplayLabel, createUrlSlug } from '../lib/utils'
import {
  validateCreateCampaign,
  validateUpdateCampaign,
  validateCampaignId,
  ValidationError,
} from '../lib/validation'
import { getGuestCampaigns, createGuestCampaign } from '../lib/guestData'
import CreateCampaignModal from '../components/campaigns/CreateCampaignModal'
import EditCampaignModal from '../components/campaigns/EditCampaignModal'
import DeleteCampaignModal from '../components/campaigns/DeleteCampaignModal'
import { LoadingSpinner } from '../components/ui'
import Logo from '../components/ui/logo.webp'

export default memo(function CampaignList() {
  const navigate = useNavigate()
  const location = useLocation()
  const { authState, signOut } = useAuth()

  useEffect(() => {
    document.title = 'Campaigns — Squill'
  }, [])
  const { user, isGuest } = authState
  const { error, message, setFail, setSuccess, clear } = useFormState()

  // Extract current campaign slug from URL (e.g., /campaigns/my-campaign-a1b2)
  const currentCampaignSlug = location.pathname.match(/^\/campaigns\/([^\/]+)(?:\/|$)/)?.[1] || null

  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)
  // useRef instead of useState: menuPosition only positions an absolutely-placed menu,
  // it doesn't need to trigger a React re-render
  const menuPositionRef = useRef({ top: 0, left: 0 })
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [campaignsExpanded, setCampaignsExpanded] = useState(true)

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [deletingCampaign, setDeletingCampaign] = useState(null)

  // Memoize filtered list so the filter() doesn't run twice per render
  // (once for desktop table, once for mobile cards)
  const filteredCampaigns = useMemo(
    () => campaigns.filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [campaigns, searchQuery]
  )

  useEffect(() => {
    if (authState.isLoading || !authState.user) return
    loadCampaigns()
  }, [authState.isLoading, authState.user, isGuest])

  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId) setOpenMenuId(null)
    }
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  const loadCampaigns = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    // Return demo campaign for guest users
    if (isGuest) {
      setCampaigns(getGuestCampaigns(user.id))
      setLoading(false)
      return
    }

    try {
      const client = requireSupabase()

      // Parallel queries for efficiency
      const [campaignsResult, pinsResult, partySizesResult, sessionsResult] = await Promise.all([
        client.from('campaigns').select('id, slug, name, description, created_at, updated_at, created_by, invite_code, streak_count, streak_cadence').order('created_at', { ascending: false }),
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

      setCampaigns(processed)
    } catch (err) {
      setFail(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCampaign = async ({ name, description }) => {
    try {
      // Validate input before database operation
      const validated = validateCreateCampaign({ name, description })

      if (isGuest) {
        const slug = createUrlSlug(validated.name)
        const guestCampaign = createGuestCampaign(user.id, {
          name: validated.name,
          description: validated.description,
          slug,
        })
        setShowCreateModal(false)
        await loadCampaigns()
        navigate(`/campaigns/${guestCampaign.slug}`)
        return
      }

      const client = requireSupabase()
      const slug = createUrlSlug(validated.name)
      const { data, error } = await client.from('campaigns').insert([
        { name: validated.name, description: validated.description, slug, created_by: user.id }
      ]).select().single()

      if (error) throw error
      await client.from('campaign_members').insert({ campaign_id: data.id, user_id: user.id })

      setShowCreateModal(false)
      await loadCampaigns()
      navigate(`/campaigns/${data.slug}`)
    } catch (err) {
      if (err instanceof ValidationError) {
        setFail(err.getClientMessage())
      } else {
        setFail(err)
      }
    }
  }

  const handleUpdateCampaign = async (id, { name, description }) => {
    try {
      // Validate inputs before database operation
      const validated = validateUpdateCampaign({ name, description })
      const validatedId = validateCampaignId(id)

      const client = requireSupabase()
      const { data, error } = await client.rpc('update_campaign_as_gm', {
        p_campaign_id: validatedId,
        p_name: validated.name,
        p_description: validated.description
      })

      if (error) throw error
      if (!data || data.length === 0) throw new Error('Failed to update. Permission denied or campaign deleted.')

      await loadCampaigns()
      setEditingCampaign(null)
      setSuccess('Campaign updated successfully')
    } catch (err) {
      if (err instanceof ValidationError) {
        setFail(err.getClientMessage())
      } else {
        setFail(err)
      }
    }
  }

  const handleDeleteCampaign = async () => {
    try {
      // Validate campaign ID before deletion
      const validatedId = validateCampaignId(deletingCampaign.id)

      const { error } = await requireSupabase().from('campaigns').delete().eq('id', validatedId)
      if (error) throw error

      setDeletingCampaign(null)
      await loadCampaigns()
      setSuccess('Campaign deleted')
    } catch (err) {
      if (err instanceof ValidationError) {
        setFail(err.getClientMessage())
      } else {
        const msg = String(err.message || '')
        if (msg.toLowerCase().includes('row-level security')) {
          setFail('Only the GM can delete this campaign.')
        } else {
          setFail(msg || 'Failed to delete campaign')
        }
      }
    }
  }

  const handlePinCampaign = async (campaign) => {
    try {
      const client = requireSupabase()
      
      // First, always try to delete any existing pin
      const { error: deleteError } = await client.from('campaign_pins').delete().eq('campaign_id', campaign.id).eq('user_id', user.id)
      if (deleteError) throw deleteError
      
      // If currently unpinned, insert new pin
      if (!campaign.pinned) {
        const { error: insertError } = await client.from('campaign_pins').insert({ campaign_id: campaign.id, user_id: user.id })
        if (insertError) throw insertError
      }

      setOpenMenuId(null)
      await loadCampaigns()
    } catch (err) {
      setFail(err)
    }
  }

  const handleCopyLink = async (campaign) => {
    if (!campaign?.invite_code) return
    const success = await copyInviteLink(campaign.invite_code, setSuccess)
    if (success) {
      setOpenMenuId(null)
      setTimeout(clear, 2000)
    }
  }

  const isRecentlyModified = (updatedAt) => {
    if (!updatedAt) return false
    return new Date(updatedAt) > new Date(Date.now() - 12 * 60 * 60 * 1000)
  }

  // For the campaigns list page, there's no single selected campaign, so this is always false
  const isSelected = false

  if (loading) {
    return <LoadingSpinner />
  }

  const profileLabel = getDisplayLabel(authState)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 font-sans text-slate-900 dark:text-gray-100 relative">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        bg-white dark:bg-gray-800 flex flex-col shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.35)]
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-5 flex items-center justify-between">
          <button
            onClick={() => navigate('/campaigns')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img src={Logo} alt="Squill Logo" className="size-8" loading="lazy" />
            <h1 className="text-2xl font-bold tracking-tight">Squill</h1>
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {/* Campaigns Button */}
          <div>
            <div className="w-full flex items-center gap-3">
              <button
                onClick={() => {/* Already on campaigns page */ }}
                className="flex-1 flex items-center gap-3 px-3 py-1.5 rounded-md transition-colors bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-sm font-medium flex-1 text-left">Campaigns</span>
              </button>
              <button
                onClick={() => setCampaignsExpanded(!campaignsExpanded)}
                className="p-1.5 hover:bg-brand-100 dark:hover:bg-brand-900/40 rounded-md transition-colors"
                aria-expanded={campaignsExpanded}
                aria-label={campaignsExpanded ? 'Collapse campaigns list' : 'Expand campaigns list'}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${campaignsExpanded ? 'rotate-180' : ''} text-brand-700 dark:text-brand-400`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Campaigns Submenu */}
            {campaignsExpanded && (
              <div className="mt-1 space-y-0.5 pl-3">
                {loading ? (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-gray-400">Loading...</div>
                ) : campaigns.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-gray-400">No campaigns</div>
                ) : (
                  campaigns.map((campaign) => {
                    const isSelected = campaign.slug === currentCampaignSlug
                    return (
                      <button
                        key={campaign.id}
                        onClick={() => {
                          navigate(`/campaigns/${campaign.slug}`)
                          setMobileMenuOpen(false)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm truncate ${
                          isSelected
                            ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 font-medium'
                            : 'hover:bg-slate-50 dark:hover:bg-gray-700/50 text-slate-700 dark:text-gray-300'
                        }`}
                        title={campaign.name}
                      >
                        {campaign.name}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-gray-700 relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-2.5 p-1.5 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-md cursor-pointer transition-colors"
          >
            <div className="size-8 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-gray-300">
              {profileLabel.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-sm font-medium truncate">{profileLabel}</p>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-xl rounded-md overflow-hidden z-20">
              <button
                onClick={() => { setShowUserMenu(false); navigate('/settings') }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                Settings
              </button>
              <button
                onClick={() => { setShowUserMenu(false); signOut().then(() => navigate('/auth')) }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-gray-700 flex items-center gap-2 border-t border-slate-100 dark:border-gray-700 text-red-600 dark:text-red-400"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden w-full">
        <div className="p-4 lg:p-6 w-full">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 flex items-center justify-between" role="alert">
              <span>{error}</span>
              <button onClick={clear} className="text-sm font-bold hover:underline">Dismiss</button>
            </div>
          )}
          {message && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-full shadow-xl border border-green-200 dark:border-green-700 flex items-center gap-4 transition-all animate-in fade-in slide-in-from-bottom-4" role="status" aria-live="polite">
              <span className="font-medium">{message}</span>
              <button onClick={clear} className="p-1 hover:bg-black/10 rounded-full transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                <svg className="w-6 h-6 text-slate-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight whitespace-nowrap lg:block hidden">Your Campaigns</h2>
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight whitespace-nowrap lg:hidden">Campaigns</h2>
            </div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:flex-none lg:w-56">
                <label htmlFor="campaign-search" className="sr-only">Search campaigns</label>
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="campaign-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search campaigns..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-md text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-brand-600 text-white px-3 lg:px-4 py-2 rounded-md text-sm font-semibold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden lg:inline">New Campaign</span>
                <span className="lg:hidden">New</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] overflow-x-auto">
            {/* Desktop Table View */}
            <table className="w-full text-left hidden lg:table">
              <thead>
                <tr className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-700 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Campaign Name</th>
                  <th className="px-6 py-3">Party Size</th>
                  <th className="px-6 py-3">Sessions</th>
                  <th className="px-6 py-3">Last Modified</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <p className="mb-2">No campaigns found.</p>
                      <button onClick={() => setShowCreateModal(true)} className="text-brand-600 hover:underline">
                        Create one now
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredCampaigns.map((campaign) => {
                      const isOwner = user && campaign.created_by === user.id
                      const isSelected = campaign.slug === currentCampaignSlug
                      return (
                        <tr
                          key={campaign.id}
                          className={`transition-colors cursor-pointer group ${
                            isSelected
                              ? 'bg-brand-50 dark:bg-brand-900/10'
                              : 'hover:bg-slate-50 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => navigate(`/campaigns/${campaign.slug}`)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col max-w-xs">
                              <div className="flex items-center gap-2">
                                {isRecentlyModified(campaign.updated_at) && (
                                  <span className="size-2 bg-brand-500 rounded-full" title="Recently active" />
                                )}
                                <span className="font-medium text-slate-900 dark:text-gray-100 truncate">{campaign.name}</span>
                                {campaign.pinned && (
                                  <svg className="w-3 h-3 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M16 5c.55 0 1 .45 1 1v5.586l3 3V16H13v6l-1 1-1-1v-6H4v-1.414l3-3V6c0-.55.45-1 1-1h8zm-2 2H8v6.414l-2 2V14h12v-.586l-2-2V7z" />
                                  </svg>
                                )}
                              </div>
                              {campaign.description && (
                                <span className="text-sm text-slate-500 truncate max-w-xs">{campaign.description}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-gray-400">{campaign.party_size}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-gray-400">{campaign.session_count}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {new Date(campaign.updated_at || campaign.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (openMenuId === campaign.id) {
                                  setOpenMenuId(null)
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  menuPositionRef.current = { top: rect.bottom + 8, left: rect.right - 192 }
                                  setOpenMenuId(campaign.id)
                                }
                              }}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                )}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 px-4 py-2">
              {campaigns.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl">
                  <p className="mb-2">No campaigns found.</p>
                  <button onClick={() => setShowCreateModal(true)} className="text-brand-600 hover:underline">
                    Create one now
                  </button>
                </div>
              ) : (
                filteredCampaigns.map((campaign) => {
                    const isOwner = user && campaign.created_by === user.id
                    const isSelected = campaign.slug === currentCampaignSlug
                    return (
                      <div
                        key={campaign.id}
                        onClick={() => navigate(`/campaigns/${campaign.slug}`)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] hover:shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.08)] ${
                          isSelected
                            ? 'bg-brand-50/50 dark:bg-brand-900/15 border-brand-200 dark:border-brand-900 ring-2 ring-brand-500'
                            : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/80'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isRecentlyModified(campaign.updated_at) && (
                              <span className="size-2 bg-brand-500 rounded-full" title="Recently active" />
                            )}
                            <span className="font-medium text-slate-900 dark:text-gray-100">{campaign.name}</span>
                            {campaign.pinned && (
                              <svg className="w-3 h-3 text-brand-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M16 5c.55 0 1 .45 1 1v5.586l3 3V16H13v6l-1 1-1-1v-6H4v-1.414l3-3V6c0-.55.45-1 1-1h8zm-2 2H8v6.414l-2 2V14h12v-.586l-2-2V7z" />
                              </svg>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === campaign.id ? null : campaign.id)
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </div>

                        {campaign.description && (
                          <p className="text-sm text-slate-500 mb-3 line-clamp-2">{campaign.description}</p>
                        )}

                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-brand-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                              </svg>
                              <span>{campaign.party_size || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-brand-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M16 18H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8V8h8v2z"/>
                              </svg>
                              <span>{campaign.session_count || 0}</span>
                            </div>
                          </div>
                          <span>
                            {new Date(campaign.updated_at || campaign.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>

                        {/* Mobile Actions Menu Dropdown */}
                        {openMenuId === campaign.id && (
                          <div className="mt-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-md overflow-hidden">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyLink(campaign) }}
                              className="w-full px-4 py-3 text-sm text-left text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              Invite
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePinCampaign(campaign) }}
                              className="w-full px-4 py-3 text-sm text-left text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2 border-t border-slate-200 dark:border-gray-700"
                            >
                              {campaign.pinned ? 'Unpin' : 'Pin to Top'}
                            </button>
                            {isOwner && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingCampaign(campaign); setOpenMenuId(null) }}
                                  className="w-full px-4 py-3 text-sm text-left text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2 border-t border-slate-200 dark:border-gray-700"
                                >
                                  Edit Details
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeletingCampaign(campaign); setOpenMenuId(null) }}
                                  className="w-full px-4 py-3 text-sm text-left text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2 border-t border-slate-200 dark:border-gray-700"
                                >
                                  Delete Campaign
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <CreateCampaignModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateCampaign}
      />
      <EditCampaignModal
        isOpen={!!editingCampaign}
        onClose={() => setEditingCampaign(null)}
        campaign={editingCampaign}
        onSave={handleUpdateCampaign}
      />
      <DeleteCampaignModal
        isOpen={!!deletingCampaign}
        onClose={() => setDeletingCampaign(null)}
        campaignName={deletingCampaign?.name}
        onDelete={handleDeleteCampaign}
      />

      {/* Desktop Context Menu Overlay */}
      {openMenuId && campaigns.find(c => c.id === openMenuId) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenMenuId(null)}
        />
      )}
      {openMenuId && campaigns.find(c => c.id === openMenuId) && (
        <div 
          className="fixed z-50 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1 pointer-events-auto"
          style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
          role="menu"
        >
          {(() => {
            const campaign = campaigns.find(c => c.id === openMenuId)
            const isOwner = user && campaign.created_by === user.id
            return (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyLink(campaign) }}
                  className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  role="menuitem"
                >
                  Invite
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePinCampaign(campaign) }}
                  className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  role="menuitem"
                >
                  {campaign.pinned ? 'Unpin' : 'Pin'}
                </button>
                {isOwner && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCampaign(campaign); setOpenMenuId(null) }}
                      className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      role="menuitem"
                    >
                      Edit Details
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingCampaign(campaign); setOpenMenuId(null) }}
                      className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      role="menuitem"
                    >
                      Delete Campaign
                    </button>
                  </>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
})


