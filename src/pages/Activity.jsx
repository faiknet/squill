import { useNavigate, useParams } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import { requireSupabase } from '../lib/supabase'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useSessionData } from '../hooks/useSessionData'
import { Input, LoadingSpinner, Button } from '../components/ui'
import { formatDistanceToNowCustom } from '../lib/dateUtils'
import { getGuestSessionBySlug } from '../lib/guestData'
import { computeSessionActivities } from '../lib/sessionActivities'
import { colorFromString } from '../lib/liveblocks'

export default function Activity() {
  const { campaignSlug, sessionSlug } = useParams()
  const navigate = useNavigate()
  const { authState } = useAuth()

  useEffect(() => {
    document.title = 'Activity — Squill'
  }, [])

  const { isGuest, isLoading: authLoading } = authState
  const [campaignId, setCampaignId] = useState(null)
  const [campaignName, setCampaignName] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loadingIds, setLoadingIds] = useState(true)

  // First, resolve slugs to IDs
  useEffect(() => {
    if (authLoading) return

    if (isGuest) {
      const userId = authState.user?.id
      const guestRoute = userId ? getGuestSessionBySlug(userId, campaignSlug, sessionSlug) : null
      if (!guestRoute) {
        navigate('/campaigns')
        return
      }
      setCampaignId(guestRoute.campaign.id)
      setCampaignName(guestRoute.campaign.name)
      setSessionId(guestRoute.session.id)
      setLoadingIds(false)
      return
    }

    const resolveIds = async () => {
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
          .select('id')
          .eq('slug', sessionSlug)
          .eq('campaign_id', campaignData.id)
          .single()
        
        if (sessionError || !sessionData) {
          navigate(`/campaigns/${campaignSlug}`)
          return
        }

        setCampaignId(campaignData.id)
        setCampaignName(campaignData.name)
        setSessionId(sessionData.id)
      } catch (err) {
        console.error('Error resolving slugs:', err)
        navigate('/campaigns')
      } finally {
        setLoadingIds(false)
      }
    }

    resolveIds()
  }, [campaignSlug, sessionSlug, navigate, isGuest, authLoading, authState.user?.id])

  const {
    tags,
    activityLogs,
    campaignMembers,
    loading,
    error
  } = useSessionData(sessionId, campaignId)

  // Search, filter, and sorting states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [sortOrder, setSortOrder] = useState('newest') // 'newest' | 'oldest'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Synthesize all activities
  const allActivities = useMemo(() => {
    if (loadingIds || loading) return []
    return computeSessionActivities(activityLogs, tags, campaignMembers)
  }, [activityLogs, tags, campaignMembers, loadingIds, loading])

  // Apply filtering and sorting
  const processedActivities = useMemo(() => {
    let result = [...allActivities]

    // 1. Filter by Search Query (action or user)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        act =>
          act.user.toLowerCase().includes(q) ||
          act.action.toLowerCase().includes(q)
      )
    }

    // 2. Filter by User
    if (selectedUser) {
      result = result.filter(act => act.user === selectedUser)
    }

    // 3. Filter by Date Range
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      result = result.filter(act => new Date(act.timestamp) >= start)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter(act => new Date(act.timestamp) <= end)
    }

    // 4. Sort by Date
    result.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    })

    return result
  }, [allActivities, searchQuery, selectedUser, startDate, endDate, sortOrder])

  // Get unique list of user names for filter dropdown
  const uniqueUsers = useMemo(() => {
    const users = new Set()
    allActivities.forEach(act => {
      if (act.user) users.add(act.user)
    })
    return Array.from(users).sort()
  }, [allActivities])

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return ''
    try {
      const date = new Date(timestamp)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = String(date.getFullYear()).slice(-2)
      return `${day}-${month}-${year}`
    } catch (e) {
      return ''
    }
  }



  if (loadingIds || loading) {
    return <LoadingSpinner fullPage={false} />
  }

  return (
    <div className="flex-1 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-200 overflow-hidden">
      {error && (
        <div className="mx-6 my-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md shrink-0" role="alert">
          {error}
        </div>
      )}

      {/* Centered Control Bar matching log width */}
      <div className="border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900/50 shrink-0 py-6">
        <div className="max-w-4xl mx-auto w-full px-6 flex flex-col gap-4">
          
          {/* Search bar taking full width of max-w-4xl */}
          <div className="relative w-full">
            <label htmlFor="search-activity" className="sr-only">Search activities</label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                width="20"
                height="20"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                id="search-activity"
                type="text"
                placeholder="Search activity description or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-800 text-base"
              />
            </div>
          </div>          {/* Filters and Controls spaced out evenly with gap-6 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-wrap items-center justify-center gap-6 w-full">
              
              {/* Date Range Selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-slate-400 dark:text-gray-550 uppercase tracking-wider">Dates:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-md border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent cursor-pointer transition-colors"
                  aria-label="Start Date"
                />
                <span className="text-slate-400 dark:text-gray-600 text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-md border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent cursor-pointer transition-colors"
                  aria-label="End Date"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 font-medium px-2 py-1 rounded hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
                  >
                    Clear Dates
                  </button>
                )}
              </div>

              {/* Sort Order */}
              <Button
                onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                variant="outline"
                className="flex items-center gap-2 border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-900 shrink-0"
              >
                <svg
                  className={`w-4 h-4 text-slate-500 dark:text-gray-400 transition-transform duration-200 ${sortOrder === 'oldest' ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <span>
                  {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                </span>
              </Button>

              {/* User Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 dark:text-gray-555 uppercase tracking-wider">User:</span>
                <select
                  id="user-filter"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="rounded-md border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent cursor-pointer transition-colors"
                >
                  <option value="">All Users</option>
                  {uniqueUsers.map(user => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Activity List Container */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {processedActivities.length > 0 ? (
            <div className="space-y-4">
              {processedActivities.map((activity, i) => {
                const userColor = colorFromString(activity.user || '')
                return (
                  <div key={i} className="relative group transition-opacity duration-200" style={{ contentVisibility: 'auto', containIntrinsicSize: '64px' }}>
                    <div className="bg-slate-50/30 dark:bg-gray-900/10 hover:bg-slate-50/80 dark:hover:bg-gray-900/30 border border-slate-100/50 dark:border-gray-800/40 hover:border-slate-200/60 dark:hover:border-gray-700/50 p-4 rounded-xl transition-all duration-200 flex flex-row items-center justify-between gap-4 shadow-sm hover:shadow">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Circle user avatar indicator */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold select-none shrink-0"
                          style={{ backgroundColor: userColor }}
                        >
                          {activity.user?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm text-slate-700 dark:text-gray-200 break-words">
                            <span className="font-semibold text-slate-900 dark:text-white mr-1.5">
                              {activity.user}
                            </span>
                            {activity.action}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-gray-500 shrink-0 font-medium whitespace-nowrap">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50/50 dark:bg-gray-950/20 rounded-xl border border-dashed border-slate-200 dark:border-gray-800">
              <svg
                className="mx-auto h-12 w-12 text-slate-300 dark:text-gray-700 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">No activities found</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                {allActivities.length === 0 ? 'No activity has been logged for this campaign yet.' : 'Try adjusting your filters or search query.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
