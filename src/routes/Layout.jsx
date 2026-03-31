import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useSupabaseAuth'
import { getDisplayLabel } from '../lib/utils'
import { UserProfileMenu } from '../components/ui'
import Logo from '../components/ui/logo.webp'
import { requireSupabase } from '../lib/supabase'
import { MobileMenuProvider } from '../contexts/MobileMenuContext'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { authState } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [campaignsExpanded, setCampaignsExpanded] = useState(true)
  const [campaigns, setCampaigns] = useState([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)

  // Get current campaign slug from URL
  const currentCampaignSlug = location.pathname.match(/\/campaigns\/([^/]+)/)?.[1] || null
  const isOnCampaignsPage = location.pathname === '/campaigns' || location.pathname.startsWith('/campaigns/')

  // Load campaigns when sidebar is expanded
  useEffect(() => {
    if (campaignsExpanded && campaigns.length === 0 && authState.user) {
      loadCampaigns()
    }
  }, [campaignsExpanded, authState.user])

  const loadCampaigns = async () => {
    try {
      setLoadingCampaigns(true)
      const client = requireSupabase()
      const { data, error } = await client
        .from('campaigns')
        .select('id, slug, name')
        .order('updated_at', { ascending: false })
      if (error) throw error
      setCampaigns(data || [])
    } catch (err) {
      console.error('Failed to load campaigns:', err)
    } finally {
      setLoadingCampaigns(false)
    }
  }

  return (
    <MobileMenuProvider value={{ mobileMenuOpen, setMobileMenuOpen }}>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 font-sans text-slate-900 dark:text-gray-100 relative">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        border-r border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-5 flex items-center justify-between">
          <button 
            onClick={() => navigate('/campaigns')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img src={Logo} alt="Squill Logo" className="size-8" />
            <h1 className="text-2xl font-bold tracking-tight">Squill</h1>
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1 text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200"
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
                onClick={() => navigate('/campaigns')}
                className={`flex-1 flex items-center gap-3 px-3 py-1.5 rounded-md transition-colors ${
                  isOnCampaignsPage
                    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 border-l-2 border-brand-600'
                    : 'hover:bg-slate-50 dark:hover:bg-gray-700/50 text-slate-700 dark:text-gray-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-sm font-medium flex-1 text-left">Campaigns</span>
              </button>
              <button
                onClick={() => setCampaignsExpanded(!campaignsExpanded)}
                className="p-1.5 hover:bg-slate-50 dark:hover:bg-gray-700/50 rounded-md transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${campaignsExpanded ? 'rotate-180' : ''} ${
                    isOnCampaignsPage ? 'text-brand-700 dark:text-brand-400' : 'text-slate-700 dark:text-gray-300'
                  }`}
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
              <div className="mt-1 space-y-0.5 pl-3 border-l border-slate-200 dark:border-gray-700">
                {loadingCampaigns ? (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-gray-400">Loading...</div>
                ) : campaigns.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-gray-400">No campaigns</div>
                ) : (
                  campaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      onClick={() => {
                        navigate(`/campaigns/${campaign.slug}`)
                        setMobileMenuOpen(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm truncate ${
                        currentCampaignSlug === campaign.slug
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 font-medium border-l-2 border-brand-600'
                          : 'hover:bg-slate-50 dark:hover:bg-gray-700/50 text-slate-700 dark:text-gray-300'
                      }`}
                      title={campaign.name}
                    >
                      {campaign.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-gray-700 relative">
          <UserProfileMenu />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto w-full flex flex-col">
        <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
    </MobileMenuProvider>
  )
}
