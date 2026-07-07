import { useState, useEffect, useMemo, useRef, cloneElement, isValidElement } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RoomProvider, useOthers, useSelf } from '@liveblocks/react'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useSessionData } from '../hooks/useSessionData'
import { requireSupabase } from '../lib/supabase'
import { colorFromString, getSessionRoomId } from '../lib/liveblocks'
import { Button, LoadingSpinner } from '../components/ui'
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
import EditorToolbar from '../components/editor/GoogleDocsToolbar'
import PresenceSidebar from '../components/editor/PresenceSidebar'
import { computeSessionActivities } from '../lib/sessionActivities'

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
  campaignId,
  sessionId,
  campaignMembers,
  inviteCode,
  showOfflineMembers,
  mutationError,
  clearMutationError,
  onEditorReady,
  memberLabel = 'Players',
  children
}) {
  const { campaignSlug, sessionSlug } = useParams()
  const [copied, setCopied] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_MAX_WIDTH_PX)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [editorInstance, setEditorInstance] = useState(null)
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
    ? cloneElement(children, {
        onEditorReady: (ed) => {
          setEditorInstance(ed)
          onEditorReady?.(ed)
        },
      })
    : children
  const desktopSidebarWidth = isSidebarCollapsed ? 0 : sidebarWidth

  const [dismissedError, setDismissedError] = useState(false)

  useEffect(() => {
    if (mutationError) {
      setDismissedError(false)
      const timer = setTimeout(() => {
        setDismissedError(true)
        clearMutationError()
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [mutationError, clearMutationError])

  return (
    <div className="flex-1 bg-white dark:bg-gray-900 flex flex-col font-sans overflow-hidden transition-colors duration-200">
      {mutationError && !dismissedError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900/50 flex items-center justify-between" role="alert">
          <p className="text-sm text-red-700 dark:text-red-400">{mutationError}</p>
          <button
            type="button"
            onClick={() => { setDismissedError(true); clearMutationError() }}
            className="ml-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 shrink-0"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {/* Full-width toolbar row */}
      <EditorToolbar
        editor={editorInstance}
        isSidebarCollapsed={isSidebarCollapsed}
        onExpandSidebar={reopenSidebar}
        saving={saving}
        copied={copied}
        onShare={handleShare}
        onOpenExport={handleOpenExportModal}
      />
      {/* Editor + Sidebar row below the toolbar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 relative min-w-0 transition-colors duration-200 border-r border-slate-100 dark:border-gray-700">
          {editorChild}
        </div>

        {/* Right Sidebar: Presence & Activity - Hidden on Mobile */}
        <div className={`
          absolute inset-y-0 right-0 z-20 bg-white dark:bg-gray-900 w-full h-full lg:static lg:z-auto lg:w-[var(--sidebar-width)] lg:max-w-[var(--sidebar-max-width)] lg:min-w-0 border-l border-slate-100 dark:border-gray-700 transition-transform duration-200 lg:relative overflow-hidden flex flex-col
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
            <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-slate-100 dark:bg-gray-700 group-hover:bg-slate-300 dark:group-hover:bg-gray-500" />
          </button>

          <PresenceSidebar
            activeUsers={activeUsers}
            currentUser={currentUser}
            activities={activities}
            campaignMembers={campaignMembers}
            userColor={userColor}
            setUserColor={setUserColor}
            showOfflineMembers={showOfflineMembers}
            campaignSlug={campaignSlug}
            sessionSlug={sessionSlug}
            memberLabel={memberLabel}
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
      {/* Mobile floating members toggle */}
      <button
        onClick={() => setShowMobileSidebar(s => !s)}
        className="lg:hidden fixed bottom-6 right-6 z-30 size-12 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center hover:bg-brand-700 transition-colors"
        aria-label="Toggle members sidebar"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>
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
  campaignId,
  sessionId,
  activities,
  campaignMembers,
  inviteCode,
  showOfflineMembers,
  tags,
  sessionNotes,
  currentUserId,
  mutationError,
  clearMutationError,
  onEditorReady,
  memberLabel = 'Players',
}) {
  const others = useOthers()
  const self = useSelf()

  const effectiveUserColor = userColor || self?.presence?.color || colorFromString(userLabel)

  // Format current user for sidebar, including typing status from Liveblocks
  const currentUser = useMemo(() => ({
    name: userLabel,
    color: effectiveUserColor,
    isSelf: true,
    typing: self?.presence?.typing || false
  }), [userLabel, effectiveUserColor, self?.presence?.typing])

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
      campaignId={campaignId}
      sessionId={sessionId}
      campaignMembers={campaignMembers}
      inviteCode={inviteCode}
      showOfflineMembers={showOfflineMembers}
      mutationError={mutationError}
      clearMutationError={clearMutationError}
      onEditorReady={onEditorReady}
      memberLabel={memberLabel}
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
  const [campaignLabel, setCampaignLabel] = useState('Campaign')
  const [sessionLabel, setSessionLabel] = useState('Session')
  const [memberLabel, setMemberLabel] = useState('Players')
  const [gmLabel, setGmLabel] = useState('GM')
  const [loadingIds, setLoadingIds] = useState(true)
  const [resolveError, setResolveError] = useState('')

  useEffect(() => {
    document.title = campaignName ? `${campaignName} — Squill` : 'Session — Squill'
  }, [campaignName])

  // First, resolve slugs to IDs
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return

    // Handle guest users with local demo data
    if (isGuest) {
      const userId = authState.user?.id
      const guestRoute = userId ? getGuestSessionBySlug(userId, campaignSlug, sessionSlug) : null
      if (!guestRoute) {
        setResolveError('This session could not be found. It may have been deleted or the link may be incorrect.')
        return
      }
      setCampaignId(guestRoute.campaign.id)
      setCampaignName(guestRoute.campaign.name)
      setCampaignLabel(guestRoute.campaign.label_campaign || 'Campaign')
      setSessionLabel(guestRoute.campaign.label_session || 'Session')
      setMemberLabel(guestRoute.campaign.label_member || 'Players')
      setGmLabel(guestRoute.campaign.label_gm || 'GM')
      setSessionId(guestRoute.session.id)
      setLoadingIds(false)
      return
    }

    const resolveIds = async () => {
      try {
        const client = requireSupabase()
        const { data: campaignData, error: campaignError } = await client
          .from('campaigns')
          .select('id, name, label_campaign, label_session, label_member, label_gm')
          .eq('slug', campaignSlug)
          .single()

        if (campaignError || !campaignData) {
          setResolveError('This campaign could not be found. It may have been deleted or the link may be incorrect.')
          return
        }

        const { data: sessionData, error: sessionError } = await client
          .from('sessions')
          .select('id')
          .eq('slug', sessionSlug)
          .eq('campaign_id', campaignData.id)
          .single()

        if (sessionError || !sessionData) {
          setResolveError('This session could not be found. It may have been deleted or the link may be incorrect.')
          return
        }

        setCampaignId(campaignData.id)
        setCampaignName(campaignData.name)
        setCampaignLabel(campaignData.label_campaign || 'Campaign')
        setSessionLabel(campaignData.label_session || 'Session')
        setMemberLabel(campaignData.label_member || 'Players')
        setGmLabel(campaignData.label_gm || 'GM')
        setSessionId(sessionData.id)
      } catch (err) {
        console.error('Error resolving slugs:', err)
        setResolveError('Something went wrong while loading this session. Please try again.')
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
    mutationError,
    clearMutationError,
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
  const [editorInstance, setEditorInstance] = useState(null)

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
        const isUserEdit = editorInstance?.isFocused || false
        saveNote(noteContent, isUserEdit)
        lastSavedContent.current = noteContent
      }
    }, 2000) // Save after 2 seconds of inactivity

    return () => clearTimeout(timer)
  }, [noteContent, saveNote, loading, editorInstance])

  // Synthesize activities from tags and members
  const activities = useMemo(() => {
    console.log('Computing activities from:', { activityLogs, tags: tags?.length, members: campaignMembers?.length })
    return computeSessionActivities(activityLogs, tags, campaignMembers).slice(0, 20)
  }, [tags, campaignMembers, activityLogs])

  if (resolveError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center transition-colors duration-200">
        <div className="max-w-md text-center space-y-4">
          <div className="text-red-600 dark:text-red-400 p-4 border border-red-200 dark:border-red-800 rounded bg-red-50 dark:bg-red-900/20" role="alert">
            <h3 className="font-bold mb-2">Not Found</h3>
            <p>{resolveError}</p>
          </div>
          <Button onClick={() => navigate('/campaigns')}>
            Back to Campaigns
          </Button>
        </div>
      </div>
    )
  }

  // Check if still resolving slug IDs
  if (loadingIds) {
    return <LoadingSpinner fullPage={false} />
  }

  if (loading) {
    return <LoadingSpinner fullPage={false} />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center transition-colors duration-200">
        <div className="text-red-600 dark:text-red-400 p-4 border border-red-200 dark:border-red-800 rounded bg-red-50 dark:bg-red-900/20" role="alert">
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
          campaignId={campaignId}
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
          mutationError={mutationError}
          clearMutationError={clearMutationError}
          onEditorReady={setEditorInstance}
          memberLabel={memberLabel}
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
      campaignId={campaignId}
      sessionId={sessionId}
      campaignMembers={campaignMembers}
      inviteCode={inviteCode}
      showOfflineMembers={showOfflineMembers}
      mutationError={mutationError}
      clearMutationError={clearMutationError}
      onEditorReady={setEditorInstance}
      memberLabel={memberLabel}
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
