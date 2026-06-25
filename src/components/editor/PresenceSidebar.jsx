import { useMemo, useState, useEffect } from 'react'
import { UserProfileMenu } from '../ui'
import { colorFromString } from '../../lib/liveblocks'

// Component to show "Editing" based on prop with user's color
function TypingIndicator({ isTyping, userColor }) {
  if (!isTyping) {
    return <p className="text-xs text-slate-500 dark:text-gray-400 select-none">Viewing</p>
  }
  return <p className="text-xs font-medium select-none" style={{ color: userColor }}>Editing</p>
}

import { memo } from 'react'

export default memo(function PresenceSidebar({
  activeUsers = [], // from Liveblocks
  currentUser, // { name, color, isSelf }
  campaignMembers = [], // from Supabase
  activities = [],
  userColor,
  setUserColor,
  showOfflineMembers = true
}) {
  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [activities])

  // Merge campaign members with active presence
  const memberStatusList = useMemo(() => {
    // 1. Start with current user
    const list = [{
      id: 'self',
      name: currentUser?.name || 'You',
      color: currentUser?.color || '#10b981',
      status: currentUser?.typing ? 'Editing' : 'Viewing',
      isSelf: true,
      isOnline: true,
      typing: currentUser?.typing || false
    }]

    // 2. Map other active users (Liveblocks presence)
    const activeMap = new Map()
    activeUsers.forEach(u => {
      // Use name as key since we don't have user IDs in presence yet reliably
      // In a real app, you'd use u.presence.userId
      if (u.presence?.name) {
        activeMap.set(u.presence.name, u)
      }
    })

    // 3. Map campaign members (Supabase)
    // We want to show all members. If they are active, show status. If not, offline.
    // If we have duplicates (e.g. "You" is in members), filter out.

    // Note: This matching by name is fragile but works for MVP without auth IDs in presence
    campaignMembers.forEach(member => {
      const displayName = member.display_name

      // Skip self if name matches (simple check)
      if (displayName === currentUser?.name) return

      const activeUser = activeMap.get(displayName)

      if (activeUser) {
        list.push({
          id: activeUser.connectionId,
          name: displayName,
          color: activeUser.presence?.color || colorFromString(displayName),
          status: activeUser.presence?.typing ? 'Editing' : 'Viewing',
          isOnline: true,
          typing: activeUser.presence?.typing || false
        })
        activeMap.delete(displayName) // Handled
      } else {
        list.push({
          id: `offline-${member.user_id}`,
          name: displayName,
          color: colorFromString(displayName),
          status: 'Offline',
          isOnline: false,
          typing: false
        })
      }
    })

    // 4. Add remaining active users (Guests not in member list)
    activeMap.forEach((u) => {
      if (u.presence?.name !== currentUser?.name) {
        list.push({
          id: u.connectionId,
          name: u.presence.name,
          color: u.presence?.color || '#9ca3af',
          status: u.presence?.typing ? 'Editing' : 'Viewing',
          isOnline: true,
          typing: u.presence?.typing || false
        })
      }
    })

    return list.sort((a, b) => {
      // Online users first, offline users last
      if (a.isOnline === b.isOnline) return 0
      return a.isOnline ? -1 : 1
    })
  }, [activeUsers, currentUser, campaignMembers])

  const visibleMemberStatusList = useMemo(() => {
    if (showOfflineMembers) return memberStatusList
    return memberStatusList.filter((member) => member.isOnline)
  }, [memberStatusList, showOfflineMembers])

  const [activityHeight, setActivityHeight] = useState(192) // default 192px (12rem)
  const [isResizing, setIsResizing] = useState(false)

  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsResizing(true)
    const startY = e.clientY
    const startHeight = activityHeight

    const handleMouseMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY
      const newHeight = startHeight + deltaY
      setActivityHeight(Math.max(80, Math.min(500, newHeight)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return
    setIsResizing(true)
    const startY = e.touches[0].clientY
    const startHeight = activityHeight

    const handleTouchMove = (moveEvent) => {
      if (moveEvent.touches.length !== 1) return
      const deltaY = startY - moveEvent.touches[0].clientY
      const newHeight = startHeight + deltaY
      setActivityHeight(Math.max(80, Math.min(500, newHeight)))
    }

    const handleTouchEnd = () => {
      setIsResizing(false)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }

    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
  }

  return (
    <aside className="w-full bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 flex flex-col flex-1 min-h-0 font-sans transition-colors duration-200">
      {/* Scrollable area: Members + Activity */}
      <div className="flex-1 overflow-y-auto">
        {/* Members Section */}
        <div className="p-5">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Member List
          </h3>
          <div className="space-y-3">
            {visibleMemberStatusList.map((user) => (
              <div key={user.id} className={`flex items-start gap-3 ${!user.isOnline ? 'opacity-50' : ''}`} style={{ contentVisibility: 'auto', containIntrinsicSize: '40px' }}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 select-none"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${user.isOnline ? 'text-slate-900 dark:text-gray-200' : 'text-slate-500 dark:text-gray-500'}`}>
                    {user.name} {user.isSelf && '(You)'}
                  </p>
                  {user.typing ? (
                    <TypingIndicator isTyping={true} userColor={user.color} />
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-gray-400 select-none">
                      {user.status}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {visibleMemberStatusList.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-gray-600 italic">No members found.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div 
        className="p-5 border-t border-slate-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 relative flex flex-col shrink-0 select-none"
        style={{ height: `${activityHeight}px`, minHeight: '80px', maxHeight: '500px' }}
      >
        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize bg-transparent hover:bg-brand-500/30 active:bg-brand-500/50 transition-colors z-20"
        />
        <h3 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Recent Activity
        </h3>
        <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
          {sortedActivities.length > 0 ? (
            sortedActivities.slice(0, 5).map((activity, i) => (
              <div key={i} className="flex flex-col gap-0.5" style={{ contentVisibility: 'auto', containIntrinsicSize: '36px' }}>
                <span className="text-xs text-slate-600 dark:text-gray-300">
                  <span className="font-semibold text-slate-900 dark:text-gray-100">{activity.user}</span> {activity.action}
                </span>
                <span className="text-xs text-slate-400 dark:text-gray-500">
                  {timeAgo(activity.timestamp)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 dark:text-gray-600 italic">No recent activity.</p>
          )}
        </div>
      </div>

      {/* User Profile Footer - always anchored to bottom */}
      <div className="p-4 border-t border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors duration-200">
        <UserProfileMenu userColor={userColor} />
      </div>
    </aside>
  )
})

function timeAgo(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
