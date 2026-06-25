import { useState, useEffect } from 'react'
import { Outlet, useParams, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useSupabaseAuth'
import { requireSupabase } from '../../lib/supabase'
import { Button } from '../ui'
import {
  getGuestSessionBySlug,
} from '../../lib/guestData'
import { useCampaignDisplayName } from '../../lib/campaignDisplayPreferences'

/**
 * SessionTabsLayout
 *
 * A persistent layout wrapper that renders the session header + nav tabs once,
 * keeping them alive across route changes between the three session sub-pages:
 *   - Workspace  (/campaigns/:slug/sessions/:slug)
 *   - Journal    (/campaigns/:slug/sessions/:slug/journal)
 *   - Preferences (/campaigns/:slug/sessions/:slug/preferences)
 *
 * Because this component never unmounts on tab switch, CSS `transition-all` on
 * the tab buttons can animate font-size, font-weight, and background smoothly.
 */
export default function SessionTabsLayout() {
  const { campaignSlug, sessionSlug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { authState } = useAuth()
  const { isGuest, isLoading: authLoading } = authState

  const [campaignId, setCampaignId] = useState(null)
  const [campaignName, setCampaignName] = useState('')
  const [sessionName, setSessionName] = useState('')

  // Determine active tab from pathname
  const pathname = location.pathname
  const isJournal = pathname.endsWith('/journal')
  const isPreferences = pathname.endsWith('/preferences')
  const isWorkspace = !isJournal && !isPreferences

  // Resolve slugs → IDs + names for the breadcrumb
  useEffect(() => {
    if (authLoading) return

    if (isGuest) {
      const userId = authState.user?.id
      const guestRoute = userId ? getGuestSessionBySlug(userId, campaignSlug, sessionSlug) : null
      if (guestRoute) {
        setCampaignId(guestRoute.campaign.id)
        setCampaignName(guestRoute.campaign.name)
        setSessionName(guestRoute.session.name || 'Session')
      }
      return
    }

    const resolveNames = async () => {
      try {
        const client = requireSupabase()
        const { data: campaignData, error: campaignError } = await client
          .from('campaigns')
          .select('id, name')
          .eq('slug', campaignSlug)
          .single()

        if (campaignError || !campaignData) {
          navigate('/campaigns')
          return
        }

        const { data: sessionData, error: sessionError } = await client
          .from('sessions')
          .select('id, name')
          .eq('slug', sessionSlug)
          .eq('campaign_id', campaignData.id)
          .single()

        if (sessionError || !sessionData) {
          navigate(`/campaigns/${campaignSlug}`)
          return
        }

        setCampaignId(campaignData.id)
        setCampaignName(campaignData.name)
        setSessionName(sessionData.name || 'Session')
      } catch (err) {
        console.error('SessionTabsLayout: error resolving slugs:', err)
        navigate('/campaigns')
      }
    }

    resolveNames()
  }, [campaignSlug, sessionSlug, navigate, isGuest, authLoading, authState.user?.id])

  // Use campaign display name (alias) if set
  const { displayName } = useCampaignDisplayName(campaignId)
  const effectiveCampaignName = displayName || campaignName

  // Tab class helpers — these apply transition-all so font-size/weight/bg animate
  const activeTabClass =
    'px-3 py-1.5 text-sm lg:text-base font-bold bg-white dark:bg-gray-900 text-slate-900 dark:text-white rounded text-center transition-all duration-200 ease-in-out'
  const inactiveTabClass =
    'px-3 py-1.5 text-xs lg:text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 rounded text-center transition-all duration-200 ease-in-out'

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col font-sans overflow-hidden transition-colors duration-200">
      {/* Persistent Header — never unmounts on tab switch */}
      <header className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 flex flex-col lg:flex-row lg:h-16 lg:items-center lg:justify-between px-4 lg:px-6 shrink-0 transition-colors duration-200 z-10 gap-2 lg:gap-0">
        {/* Row 1: Back button + Breadcrumb */}
        <div className="flex items-center justify-between w-full lg:w-auto h-14 lg:h-auto gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              onClick={() => navigate(`/campaigns/${campaignSlug}`)}
              variant="ghost"
              className="text-sm text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white pl-0 shrink-0 hover:bg-transparent dark:hover:bg-transparent"
            >
              <span className="hidden lg:inline">Back</span>
              <span className="lg:hidden">←</span>
            </Button>
            <div className="h-6 w-px bg-slate-200 dark:bg-gray-700 mx-1 lg:mx-2 shrink-0" />
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-xs lg:text-sm text-slate-400 dark:text-gray-500 truncate max-w-[80px] sm:max-w-[150px] lg:max-w-[200px]">
                {effectiveCampaignName}
              </span>
              <span className="text-xs text-slate-300 dark:text-gray-600 shrink-0">/</span>
              <h1 className="text-base lg:text-lg font-semibold text-slate-900 dark:text-gray-100 truncate font-sans">
                {sessionName}
              </h1>
            </div>
          </div>
        </div>

        {/* Row 2: Nav Tabs — centered, persistent, animated */}
        <div className="w-full lg:w-auto pb-3 lg:pb-0 flex items-center justify-center">
          <nav
            className="flex items-center bg-slate-100 dark:bg-gray-800 p-1 shrink-0 rounded-md w-full lg:w-auto grid grid-cols-3 lg:flex lg:flex-row gap-0.5"
            aria-label="Session navigation"
          >
            <button
              onClick={() => navigate(`/campaigns/${campaignSlug}/sessions/${sessionSlug}`)}
              className={isWorkspace ? activeTabClass : inactiveTabClass}
              aria-current={isWorkspace ? 'page' : undefined}
            >
              <span className="hidden lg:inline">Workspace</span>
              <span className="lg:hidden">Edit</span>
            </button>
            <button
              onClick={() => navigate(`/campaigns/${campaignSlug}/sessions/${sessionSlug}/journal`)}
              className={isJournal ? activeTabClass : inactiveTabClass}
              aria-current={isJournal ? 'page' : undefined}
            >
              Journal
            </button>
            <button
              onClick={() => navigate(`/campaigns/${campaignSlug}/sessions/${sessionSlug}/preferences`)}
              className={isPreferences ? activeTabClass : inactiveTabClass}
              aria-current={isPreferences ? 'page' : undefined}
            >
              Preferences
            </button>
          </nav>
        </div>

        {/* Desktop right spacer — keeps tabs visually centered */}
        <div className="hidden lg:block lg:w-1/4" />
      </header>

      {/* Page content — swaps on route change, header stays alive */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
