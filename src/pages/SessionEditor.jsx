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
import '../styles/mentions.css'

import LocalEditor from '../components/editor/LocalEditor'
import CollaborativeEditor from '../components/editor/CollaborativeEditor'
import PresenceSidebar from '../components/editor/PresenceSidebar'

const SESSION_EDITOR_COLOR_STORAGE_KEY = 'squill:session-editor:user-color'
const DEFAULT_EDITOR_HEIGHT_PX = 350
const SIDEBAR_MAX_WIDTH_PX = 352
const SIDEBAR_VIEWING_MIN_WIDTH_PX = 150

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

function EditorLayout({
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
  campaignSlug,
  sessionSlug,
  sessionId,
  campaignMembers,
  inviteCode,
  showOfflineMembers,
  children
}) {
  const [copied, setCopied] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_MAX_WIDTH_PX)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const sidebarRef = useRef(null)
  const shareUrl = inviteCode
    ? `${window.location.origin}/join/${inviteCode}`
    : window.location.href

  useEffect(() => {
    if (!isResizingSidebar) return

    const handleMouseMove = (event) => {
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
    }

    const stopResizing = () => setIsResizingSidebar(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResizing)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', stopResizing)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
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

  const handleExport = async (format) => {
    setIsExporting(true)
    setExportError('')

    try {
      await exportSessionNotes({
        format,
        noteContent,
        sessionName: session?.name || 'session-notes',
      })
      setIsExportModalOpen(false)
    } catch (error) {
      console.error('Failed to export session notes:', error)
      setExportError(error?.message || 'Failed to export notes. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const editorChild = isValidElement(children)
    ? cloneElement(children, { isSidebarCollapsed, onExpandSidebar: reopenSidebar })
    : children
  const desktopSidebarWidth = isSidebarCollapsed ? 0 : sidebarWidth

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col font-sans overflow-hidden transition-colors duration-200">
      {/* Header */}
      <header className="h-16 px-4 md:px-6 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between z-10 shrink-0 gap-2 transition-colors duration-200">
        <div className="flex items-center gap-2 md:gap-4 flex-1 md:flex-none md:w-1/4 min-w-0">
          <Button
            onClick={() => navigate(`/campaigns/${campaignSlug}`)}
            variant="ghost"
            className="text-sm text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white pl-0 shrink-0 hover:bg-transparent dark:hover:bg-transparent"
          >
            <span className="hidden md:inline">Back</span>
            <span className="md:hidden">←</span>
          </Button>
          <div className="h-6 w-px bg-slate-200 dark:bg-gray-700 mx-1 md:mx-2 shrink-0"></div>
          <h1 className="text-base md:text-lg font-semibold text-slate-900 dark:text-gray-100 truncate font-sans">
            {session?.name || 'Session'}
          </h1>
        </div>

        {/* Navigation Tabs - Centered */}
        <div className="flex-1 flex items-center justify-center">
          <nav className="flex items-center bg-slate-100 dark:bg-gray-800 p-1 border border-slate-200 dark:border-gray-700 shrink-0 rounded-md">
            <button
              className="px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-medium bg-white dark:bg-gray-900 text-slate-900 dark:text-white border border-slate-200 dark:border-gray-700 transition-colors"
            >
              <span className="hidden md:inline">Workspace</span>
              <span className="md:hidden">Edit</span>
            </button>
            <button
              onClick={() => navigate(`/campaigns/${campaignSlug}/sessions/${sessionSlug || session?.slug || sessionId}/journal`)}
              className="px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
            >
              Journal
            </button>
            <button
              onClick={() => navigate(`/campaigns/${campaignSlug}/sessions/${sessionSlug || session?.slug || sessionId}/preferences`)}
              className="px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
            >
              Preferences
            </button>
          </nav>
        </div>

        <div className="flex items-center justify-end gap-2 md:gap-3 flex-1 md:flex-none md:w-1/4">
          {saving && (
            <span className="text-xs text-slate-500 dark:text-gray-500 hidden xl:inline-block whitespace-nowrap">
              Saving...
            </span>
          )}
          {!saving && (
            <SavedIndicator />
          )}
          <Button
            variant="outline"
            className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 min-w-[60px] md:min-w-[80px] h-8 md:h-9 text-xs md:text-sm px-2 md:px-4"
            onClick={handleOpenExportModal}
          >
            Export
          </Button>
          <Button
            variant="outline"
            className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 min-w-[60px] md:min-w-[80px] h-8 md:h-9 text-xs md:text-sm px-2 md:px-4"
            onClick={handleShare}
          >
            {copied ? 'Copied!' : 'Share'}
          </Button>
          <button
            onClick={() => setShowMobileSidebar(true)}
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
          absolute inset-0 z-20 bg-white dark:bg-gray-900 lg:static lg:z-auto lg:w-[var(--sidebar-width)] lg:max-w-[var(--sidebar-max-width)] lg:min-w-0 border-l border-slate-200 dark:border-gray-700 transition-transform duration-200 relative lg:overflow-hidden
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
}

function CollaborativeSessionContent({
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
}

// --- Main Component ---

export default function SessionEditor() {
  const { campaignSlug, sessionSlug } = useParams()
  const navigate = useNavigate()
  const { authState } = useAuth()
  const { isGuest, isLoading: authLoading } = authState
  const [campaignId, setCampaignId] = useState(null)
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
      setSessionId(guestRoute.session.id)
      setLoadingIds(false)
      return
    }

    const resolveIds = async () => {
      try {
        const client = requireSupabase()
        const { data: campaignData, error: campaignError } = await client
          .from('campaigns')
          .select('id')
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

  const [userColor, setUserColor] = useState(() => {
    if (typeof window === 'undefined') return ''
    const stored = window.localStorage.getItem(SESSION_EDITOR_COLOR_STORAGE_KEY)
    return stored || ''
  })
  const [showOfflineMembers] = useState(() => getShowOfflineMembersPreference())

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
          if (creatorId && campaignMembers) {
            const creator = campaignMembers.find(m => m.user_id === creatorId)
            if (creator) creatorName = creator.display_name
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
        if (log.user_id && campaignMembers) {
          const user = campaignMembers.find(m => m.user_id === log.user_id)
          if (user) userName = user.display_name
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
  const userLabel = getDisplayLabel(authState, 'Guest')
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
}
