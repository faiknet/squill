import { useState, useEffect, useMemo, useRef, cloneElement, isValidElement } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RoomProvider, useOthers, useSelf } from '@liveblocks/react'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useSessionData } from '../hooks/useSessionData'
import { requireSupabase } from '../lib/supabase'
import { colorFromString, getSessionRoomId } from '../lib/liveblocks'
import { Button } from '../components/ui'
import ExportSessionNotesModal from '../components/sessions/ExportSessionNotesModal'
import { exportSessionNotes } from '../lib/sessionNoteExport'
import { getDisplayLabel } from '../lib/utils'
import {
  getGuestSessionBySlug,
} from '../lib/guestData'
import { getShowOfflineMembersPreference } from '../lib/sessionDisplayPreferences'
import { useCampaignDisplayName } from '../lib/campaignDisplayPreferences'
import '../styles/mentions.css'

import LocalEditor from '../components/editor/LocalEditor'
import CollaborativeEditor from '../components/editor/CollaborativeEditor'
import PresenceSidebar from '../components/editor/PresenceSidebar'

const SESSION_EDITOR_COLOR_STORAGE_KEY = 'squill:session-editor:user-color'
const DEFAULT_EDITOR_HEIGHT_PX = 350
const SIDEBAR_MAX_WIDTH_PX = 352
const SIDEBAR_VIEWING_MIN_WIDTH_PX = 150
const EXPORT_REFERENCE_BLACK_COLOR = '#000000'
const EXPORT_REFERENCE_COLOR_OVERRIDES = [
  {
    attribute: 'data-npc-reference-mention-custom-color',
    cssVariable: '--npc-reference-mention-color',
  },
  {
    attribute: 'data-item-reference-mention-custom-color',
    cssVariable: '--item-reference-mention-color',
  },
  {
    attribute: 'data-pet-reference-mention-custom-color',
    cssVariable: '--pet-reference-mention-color',
  },
  {
    attribute: 'data-location-reference-mention-custom-color',
    cssVariable: '--location-reference-mention-color',
  },
  {
    attribute: 'data-session-reference-mention-custom-color',
    cssVariable: '--session-reference-mention-color',
  },
]

function snapshotReferenceColorOverrides(rootElement) {
  return EXPORT_REFERENCE_COLOR_OVERRIDES.map(({ attribute, cssVariable }) => ({
    attribute,
    cssVariable,
    attributeValue: rootElement.getAttribute(attribute),
    cssVariableValue: rootElement.style.getPropertyValue(cssVariable),
  }))
}

function applyBlackReferenceColorOverrides(rootElement) {
  EXPORT_REFERENCE_COLOR_OVERRIDES.forEach(({ attribute, cssVariable }) => {
    rootElement.setAttribute(attribute, 'true')
    rootElement.style.setProperty(cssVariable, EXPORT_REFERENCE_BLACK_COLOR)
  })
}

function restoreReferenceColorOverrides(rootElement, snapshot) {
  snapshot.forEach(({ attribute, cssVariable, attributeValue, cssVariableValue }) => {
    if (attributeValue === null) {
      rootElement.removeAttribute(attribute)
    } else {
      rootElement.setAttribute(attribute, attributeValue)
    }

    if (cssVariableValue) {
      rootElement.style.setProperty(cssVariable, cssVariableValue)
    } else {
      rootElement.style.removeProperty(cssVariable)
    }
  })
}

// SavedIndicator component
function SavedIndicator() {
  const [show, setShow] = useState(true)

  useEffect(() => {
    setShow(true)
    const timer = setTimeout(() => setShow(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  if (!show) return null

  return (
    <span className="text-xs text-slate-500 dark:text-gray-500 hidden xl:inline-block whitespace-nowrap">
      All changes saved
    </span>
  )
}

// --- Helper Components for Layout ---

import { memo } from 'react'
const EditorLayout = memo(function EditorLayout({
  session,
  saving,
  saveNote,
  noteContent,
  setNoteContent,
  userColor,
  setUserColor,
  activeUsers,
  currentUser,
  activities,
  navigate,
  campaignId,
  campaignName,
  campaignSlug,
  sessionSlug,
  sessionId,
  campaignMembers,
  inviteCode,
  showOfflineMembers,
  children
}) {
  const { displayName } = useCampaignDisplayName(campaignId)
  const [copied, setCopied] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_MAX_WIDTH_PX)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const sidebarRef = useRef(null)
  // RAF handle for throttling resize — prevents 60+ React state updates per second
  const resizeRafRef = useRef(null)
  const shareUrl = inviteCode
    ? `${window.location.origin}/join/${inviteCode}`
    : window.location.href

  useEffect(() => {
    if (!isResizingSidebar) return

    const handleMouseMove = (event) => {
      // Throttle via requestAnimationFrame: coalesce multiple mousemove events into
      // a single React state update per animation frame (~16ms), eliminating layout thrashing
      if (resizeRafRef.current !== null) return
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null
        if (!sidebarRef.current) return
        const { right } = sidebarRef.current.getBoundingClientRect()
        const nextWidth = right - event.clientX
        if (nextWidth <= SIDEBAR_VIEWING_MIN_WIDTH_PX) {
          setSidebarWidth(SIDEBAR_VIEWING_MIN_WIDTH_PX)
          setIsSidebarCollapsed(true)
          setIsResizingSidebar(false)
          return
        }
        const clampedWidth = Math.min(
          SIDEBAR_MAX_WIDTH_PX,
          Math.max(SIDEBAR_VIEWING_MIN_WIDTH_PX, nextWidth)
        )
        setSidebarWidth(clampedWidth)
      })
    }

    const stopResizing = () => {
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current)
        resizeRafRef.current = null
      }
      setIsResizingSidebar(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResizing)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', stopResizing)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current)
        resizeRafRef.current = null
      }
    }
  }, [isResizingSidebar])

  const startSidebarResize = (event) => {
    event.preventDefault()
    setIsResizingSidebar(true)
  }

  const reopenSidebar = () => {
    setSidebarWidth(SIDEBAR_MAX_WIDTH_PX)
    setIsSidebarCollapsed(false)
  }

  const handleShare = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenExportModal = () => {
    setExportError('')
    setIsExportModalOpen(true)
  }

  const handleCloseExportModal = () => {
    if (isExporting) return
    setExportError('')
    setIsExportModalOpen(false)
  }

  const handleExport = async (format, keepJournalEntityFormatting = true) => {
    setIsExporting(true)
    setExportError('')
    const shouldForceBlackReferenceColors = !keepJournalEntityFormatting
    const rootElement = document.documentElement
    const colorOverrideSnapshot = shouldForceBlackReferenceColors
      ? snapshotReferenceColorOverrides(rootElement)
      : null

    try {
      if (shouldForceBlackReferenceColors) {
        applyBlackReferenceColorOverrides(rootElement)
      }

      await exportSessionNotes({
        format,
        noteContent,
        sessionName: session?.name || 'session-notes',
        keepJournalEntityFormatting,
      })
      setIsExportModalOpen(false)
    } catch (error) {
      console.error('Failed to export session notes:', error)
      setExportError(error?.message || 'Failed to export notes. Please try again.')
    } finally {
      if (colorOverrideSnapshot) {
        restoreReferenceColorOverrides(rootElement, colorOverrideSnapshot)
      }
      setIsExporting(false)
    }
  }

  const editorChild = isValidElement(children)
    ? cloneElement(children, { isSidebarCollapsed, onExpandSidebar: reopenSidebar })
    : children
  const desktopSidebarWidth = isSidebarCollapsed ? 0 : sidebarWidth

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col font-sans overflow-hidden transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 flex flex-col md:flex-row md:h-16 md:items-center md:justify-between px-4 md:px-6 shrink-0 transition-colors duration-200 z-10 gap-2 md:gap-0">
        {/* Row 1: Back, Title, and Actions on mobile */}
        <div className="flex items-center justify-between w-full md:w-auto h-14 md:h-auto gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              onClick={() => navigate(`/campaigns/${campaignSlug}`)}
              variant="ghost"
              className="text-sm text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white pl-0 shrink-0 hover:bg-transparent dark:hover:bg-transparent"
            >
              <span className="hidden md:inline">Back</span>
              <span className="md:hidden">←</span>
            </Button>
            <div className="h-6 w-px bg-slate-200 dark:bg-gray-700 mx-1 md:mx-2 shrink-0"></div>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-xs md:text-sm text-slate-400 dark:text-gray-500 truncate max-w-[80px] sm:max-w-[150px] md:max-w-[200px]">
                {campaignName}
              </span>
              <span className="text-xs text-slate-300 dark:text-gray-600 shrink-0">/</span>
              <h1 className="text-base md:text-lg font-semibold text-slate-900 dark:text-gray-100 truncate font-sans">
                {session?.name || 'Session'}
              </h1>
            </div>
          </div>

          {/* Action buttons (Share, Members) on mobile - visible on mobile, hidden on desktop */}
          <div className="flex items-center gap-1.5 md:hidden">
            <Button
              variant="outline"
              className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 h-10 text-xs px-2.5 min-w-[55px]"
              onClick={handleShare}
            >
              {copied ? 'Copied!' : 'Share'}
            </Button>
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="p-2 text-slate-400 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 rounded-md"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Centered/Second Row */}
        <div className="w-full md:w-auto pb-3 md:pb-0 flex items-center justify-center">
          <nav className="flex items-center bg-slate-100 dark:bg-gray-800 p-1 border border-slate-200 dark:border-gray-700 shrink-0 rounded-md w-full md:w-auto grid grid-cols-3 md:flex md:flex-row gap-0.5">
            <button
              className="px-3 py-1.5 text-xs md:text-sm font-medium bg-white dark:bg-gray-900 text-slate-900 dark:text-white border border-slate-200 dark:border-gray-700 transition-colors rounded text-center"
            >
              <span className="hidden md:inline">Workspace</span>
              <span className="md:hidden">Edit</span>
            </button>
            <button
              onClick={() => navigate(`/campaigns/${campaignSlug}/sessions/${sessionSlug || session?.slug || sessionId}/journal`)}
              className="px-3 py-1.5 text-xs md:text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors rounded text-center"
            >
              Journal
            </button>
            <button
              onClick={() => navigate(`/campaigns/${campaignSlug}/sessions/${sessionSlug || session?.slug || sessionId}/preferences`)}
              className="px-3 py-1.5 text-xs md:text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors rounded text-center"
            >
              Preferences
            </button>
          </nav>
        </div>

        {/* Desktop actions section - hidden on mobile */}
        <div className="hidden md:flex items-center justify-end gap-2 md:gap-3 md:w-1/4">
          <Button
            variant="outline"
            className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 min-w-[60px] md:min-w-[80px] h-11 md:h-9 text-xs md:text-sm px-2 md:px-4"
            onClick={handleOpenExportModal}
          >
            Export
          </Button>
          <Button
            variant="outline"
            className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 min-w-[60px] md:min-w-[80px] h-11 md:h-9 text-xs md:text-sm px-2 md:px-4"
            onClick={handleShare}
          >
            {copied ? 'Copied!' : 'Share'}
          </Button>
          <button
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 rounded-md"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 relative min-w-0 transition-colors duration-200 border-r border-slate-200 dark:border-gray-700">
          {editorChild}
        </div>

        {/* Right Sidebar: Presence & Activity - Hidden on Mobile */}
        <div className={`
          absolute inset-y-0 right-0 z-20 bg-white dark:bg-gray-900 w-full h-full lg:static lg:z-auto lg:w-[var(--sidebar-width)] lg:max-w-[var(--sidebar-max-width)] lg:min-w-0 border-l border-slate-200 dark:border-gray-700 transition-transform duration-200 lg:relative overflow-hidden flex flex-col
          ${isResizingSidebar ? 'lg:transition-none' : 'lg:transition-[width] lg:duration-300 lg:ease-in-out'}
          ${isSidebarCollapsed ? 'lg:border-l-0' : ''}
          ${showMobileSidebar ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
          ref={sidebarRef}
          style={{
            '--sidebar-width': `${desktopSidebarWidth}px`,
            '--sidebar-max-width': `${SIDEBAR_MAX_WIDTH_PX}px`,
          }}
        >
          <button
            type="button"
            aria-label="Resize member sidebar"
            onMouseDown={startSidebarResize}
            className={`hidden absolute left-0 top-0 h-full w-2 -translate-x-1/2 cursor-col-resize z-20 group ${isSidebarCollapsed ? 'lg:hidden' : 'lg:block'}`}
          >
            <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-slate-200 dark:bg-gray-700 group-hover:bg-slate-400 dark:group-hover:bg-gray-500" />
          </button>
          {/* Mobile Close Header */}
          <div className="lg:hidden p-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900">
            <h3 className="font-bold text-slate-900 dark:text-gray-100">Members & Activity</h3>
            <button
              onClick={() => setShowMobileSidebar(false)}
              className="text-slate-400 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
            >
              ✕ Close
            </button>
          </div>
          <PresenceSidebar
            activeUsers={activeUsers}
            currentUser={currentUser}
            activities={activities}
            campaignMembers={campaignMembers}
            userColor={userColor}
            setUserColor={setUserColor}
            showOfflineMembers={showOfflineMembers}
          />
        </div>
      </div>
      <ExportSessionNotesModal
        isOpen={isExportModalOpen}
        onClose={handleCloseExportModal}
        onExport={handleExport}
        sessionName={session?.name}
        isExporting={isExporting}
        exportError={exportError}
        hasContent={Boolean(noteContent && noteContent !== '<p></p>')}
      />
    </div>
  )
})

const CollaborativeSessionContent = memo(function CollaborativeSessionContent({
  session,
  saving,
  saveNote,
  noteContent,
  setNoteContent,
  userColor,
  setUserColor,
  userLabel,
  navigate,
  campaignId,
  campaignName,
  campaignSlug,
  sessionSlug,
  sessionId,
  activities,
  campaignMembers,
  inviteCode,
  showOfflineMembers,
  tags,
  sessionNotes,
  currentUserId
}) {
  const others = useOthers()
  const self = useSelf()

  const effectiveUserColor = userColor || self?.presence?.color || colorFromString(userLabel)

  // Format current user for sidebar, including typing status from Liveblocks
  const currentUser = {
    name: userLabel,
    color: effectiveUserColor,
    isSelf: true,
    typing: self?.presence?.typing || false
  }

  return (
    <EditorLayout
      session={session}
      saving={saving}
      saveNote={saveNote}
      noteContent={noteContent}
      setNoteContent={setNoteContent}
      userColor={userColor}
      setUserColor={setUserColor}
      activeUsers={others}
      currentUser={currentUser}
      activities={activities}
      navigate={navigate}
      campaignId={campaignId}
      campaignName={campaignName}
      campaignSlug={campaignSlug}
      sessionSlug={sessionSlug}
      sessionId={sessionId}
      campaignMembers={campaignMembers}
      inviteCode={inviteCode}
      showOfflineMembers={showOfflineMembers}
    >
      <CollaborativeEditor
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        userLabel={userLabel}
        userColor={effectiveUserColor}
        sharedMinHeight={DEFAULT_EDITOR_HEIGHT_PX}
        campaignMembers={campaignMembers}
        journalEntities={tags}
        sessionNotes={sessionNotes}
        currentUserId={currentUserId}
      />
    </EditorLayout>
  )
})

// --- Main Component ---

export default memo(function SessionEditor() {
  const { campaignSlug, sessionSlug } = useParams()
  const navigate = useNavigate()
  const { authState } = useAuth()
  const { isGuest, isLoading: authLoading } = authState
  const [campaignId, setCampaignId] = useState(null)
  const [campaignName, setCampaignName] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loadingIds, setLoadingIds] = useState(true)

  // First, resolve slugs to IDs
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return

    // Handle guest users with local demo data
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
    session,
    noteContent,
    setNoteContent,
    tags,
    campaignMembers,
    inviteCode,
    activityLogs,
    sessionNotes,
    loading,
    error,
    saving,
    saveNote,
  } = useSessionData(sessionId, campaignId)

  const { displayName } = useCampaignDisplayName(campaignId)

  const [userColor, setUserColor] = useState(() => {
    if (typeof window === 'undefined') return ''
    const stored = window.localStorage.getItem(SESSION_EDITOR_COLOR_STORAGE_KEY)
    return stored || ''
  })
  // Read once at module load — this value never changes during a session,
  // so useState (which re-renders) is unnecessary here
  const showOfflineMembers = getShowOfflineMembersPreference()

  // Refs to track saving state and prevent initial save
  const lastSavedContent = useRef(null)
  const isFirstLoad = useRef(true)

  // Sync user color to localStorage and database
  useEffect(() => {
    if (userColor) {
      window.localStorage.setItem(SESSION_EDITOR_COLOR_STORAGE_KEY, userColor)

      // Also save to database via RPC (skip for guests and if no valid user)
      if (!isGuest && authState.user?.id) {
        ; (async () => {
          try {
            const client = requireSupabase()
            const { error } = await client.rpc('set_user_color_preference', {
              color_hex: userColor
            })
            if (error) {
              console.warn('Could not save color to database:', error.message)
            }
          } catch (err) {
            console.warn('Error saving color preference:', err.message)
          }
        })()
      }
    } else {
      window.localStorage.removeItem(SESSION_EDITOR_COLOR_STORAGE_KEY)
    }
  }, [userColor, isGuest, authState.user?.id])

  // Auto-save note content with debounce
  useEffect(() => {
    if (loading) return

    // On first load, sync the ref with the loaded content
    if (isFirstLoad.current) {
      lastSavedContent.current = noteContent
      isFirstLoad.current = false
      return
    }

    const timer = setTimeout(() => {
      // Only save if content exists, isn't empty, and HAS CHANGED from last save
      if (noteContent && noteContent !== '<p></p>' && noteContent !== lastSavedContent.current) {
        console.log('Auto-saving note content...')
        saveNote(noteContent)
        lastSavedContent.current = noteContent
      }
    }, 2000) // Save after 2 seconds of inactivity

    return () => clearTimeout(timer)
  }, [noteContent, saveNote, loading])

  // Synthesize activities from tags and members
  const activities = useMemo(() => {
    console.log('Computing activities from:', { activityLogs, tags: tags?.length, members: campaignMembers?.length })
    const list = []

    // Map for O(1) lookups instead of .find() inside loops
    const memberMap = new Map()
    if (campaignMembers) {
      campaignMembers.forEach(m => memberMap.set(m.user_id, m.display_name))
    }

    // Tag activities (Legacy support + Immediate UI update for non-logged items)
    // We filter out any tags that ALREADY have a create_entity log to avoid duplicates
    if (tags) {
      tags.slice(0, 15).forEach(tag => {
        // Check if we have a log for this tag creation already
        const hasLog = activityLogs?.some(log =>
          log.action_type === 'create_entity' &&
          log.details?.label === tag.label &&
          // Match loosely on timestamp (within 10 seconds)
          (Math.abs(new Date(log.created_at) - new Date(tag.created_at)) < 10000)
        )

        if (!hasLog) {
          let creatorName = 'Member'
          const creatorId = tag.created_by || tag.user_id
          if (creatorId && memberMap.has(creatorId)) {
            creatorName = memberMap.get(creatorId)
          }

          list.push({
            user: creatorName,
            action: `added ${tag.tag_type === 'item' ? 'inventory' : tag.tag_type}: ${tag.label}`,
            timestamp: tag.created_at
          })
        }
      })
    }

    // Document Edit Activities from Log
    if (activityLogs) {
      activityLogs.forEach(log => {
        let userName = 'Member'
        if (log.user_id && memberMap.has(log.user_id)) {
          userName = memberMap.get(log.user_id)
        }

        if (log.action_type === 'edit_document') {
          // Get session name from details fallback
          const sessionName = log.details?.session_name || 'a session'
          list.push({
            user: userName,
            action: `made changes to ${sessionName}`,
            timestamp: log.created_at
          })
        } else if (log.action_type === 'delete_entity') {
          // Map DB types to friendly names
          let typeLabel = log.details?.type || 'entity'
          if (typeLabel === 'item') typeLabel = 'inventory item'

          list.push({
            user: userName,
            action: `removed ${typeLabel}: ${log.details?.label || 'Unknown'}`,
            timestamp: log.created_at
          })
        } else if (log.action_type === 'create_entity') {
          // Also support explicit create_entity logs if we start using them
          let typeLabel = log.details?.type || 'entity'
          if (typeLabel === 'item') typeLabel = 'inventory item'

          list.push({
            user: userName,
            action: `added ${typeLabel}: ${log.details?.label || 'Unknown'}`,
            timestamp: log.created_at
          })
        } else if (log.action_type === 'join_campaign') {
          list.push({
            user: userName,
            action: 'joined the campaign',
            timestamp: log.created_at
          })
        } else if (log.action_type === 'leave_campaign') {
          list.push({
            user: userName,
            action: 'left the campaign',
            timestamp: log.created_at
          })
        }
      })
    }

    // Member joined activities
    if (campaignMembers) {
      campaignMembers.forEach(member => {
        // created_at in campaign_members usually means join time
        if (member.created_at || member.joined_at) {
          list.push({
            user: member.display_name,
            action: 'joined the campaign',
            timestamp: member.created_at || member.joined_at
          })
        }
      })
    }

    // Filter out duplicates from the combined list based on unique action+timestamp signature
    const seen = new Set()
    const finalList = list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .filter(item => {
        const signature = `${item.action}-${item.timestamp}`
        if (seen.has(signature)) return false
        seen.add(signature)
        return true
      })
      .slice(0, 20)

    return finalList
  }, [tags, campaignMembers, activityLogs])

  // Check if still resolving slug IDs
  if (loadingIds) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center transition-colors duration-200">
        <p className="text-slate-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center transition-colors duration-200">
        <p className="text-slate-500 dark:text-gray-400">Loading session...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center transition-colors duration-200">
        <div className="text-red-600 dark:text-red-400 p-4 border border-red-200 dark:border-red-800 rounded bg-red-50 dark:bg-red-900/20">
          <h3 className="font-bold mb-2">Error</h3>
          <p>{error}</p>
          <Button onClick={() => navigate(`/campaigns/${campaignSlug}`)} className="mt-4">
            Back to Campaign
          </Button>
        </div>
      </div>
    )
  }

  const collabEnabled = Boolean(import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY) && !isGuest
  const userLabel = displayName || getDisplayLabel(authState, 'Guest')
  const effectiveUserColor = userColor || colorFromString(userLabel)
  const roomId = getSessionRoomId(campaignId, sessionId)

  if (collabEnabled) {
    return (
      <RoomProvider
        id={roomId}
        initialPresence={{ cursor: null, name: userLabel, color: effectiveUserColor, typing: false }}
      >
        <CollaborativeSessionContent
          session={session}
          saving={saving}
          saveNote={saveNote}
          noteContent={noteContent}
          setNoteContent={setNoteContent}
          userColor={userColor}
          setUserColor={setUserColor}
          userLabel={userLabel}
          navigate={navigate}
          campaignId={campaignId}
          campaignName={campaignName}
          campaignSlug={campaignSlug}
          sessionSlug={sessionSlug}
          sessionId={sessionId}
          activities={activities}
          campaignMembers={campaignMembers}
          inviteCode={inviteCode}
          showOfflineMembers={showOfflineMembers}
          tags={tags}
          sessionNotes={sessionNotes}
          currentUserId={authState.user?.id}
        />
      </RoomProvider>
    )
  }

  // Local Editor Fallback
  return (
    <EditorLayout
      session={session}
      saving={saving}
      saveNote={saveNote}
      noteContent={noteContent}
      setNoteContent={setNoteContent}
      userColor={userColor}
      setUserColor={setUserColor}
      activeUsers={[]}
      currentUser={{ name: userLabel, color: effectiveUserColor, isSelf: true }}
      activities={activities}
      navigate={navigate}
      campaignId={campaignId}
      campaignName={campaignName}
      campaignSlug={campaignSlug}
      sessionSlug={sessionSlug}
      sessionId={sessionId}
      campaignMembers={campaignMembers}
      inviteCode={inviteCode}
      showOfflineMembers={showOfflineMembers}
    >
      <LocalEditor
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        sharedMinHeight={DEFAULT_EDITOR_HEIGHT_PX}
        campaignMembers={campaignMembers}
        journalEntities={tags}
        sessionNotes={sessionNotes}
        currentUserId={authState.user?.id}
        userLabel={userLabel}
        userColor={effectiveUserColor}
      />
    </EditorLayout>
  )
})
