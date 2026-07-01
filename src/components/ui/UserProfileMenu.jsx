import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useSupabaseAuth'
import { getDisplayLabel } from '../../lib/utils'
import ColorPickerModal, { USER_COLOR_OPTIONS } from './ColorPickerModal'
import AchievementsModal from '../achievements/AchievementsModal'


export default function UserProfileMenu({ collapsed = false, userColor, setUserColor }) {
  const navigate = useNavigate()
  const { authState, signOut } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isColorModalOpen, setIsColorModalOpen] = useState(false)
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false)
  const menuRef = useRef(null)
  
  const profileLabel = getDisplayLabel(authState)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className={`w-full flex items-center gap-2.5 p-1.5 hover:bg-brand-50 dark:hover:bg-brand-800/40 rounded-md cursor-pointer transition-colors ${collapsed ? 'justify-center' : ''}`}
        aria-haspopup="true"
        aria-expanded={showUserMenu}
        aria-label={`User menu for ${profileLabel}`}
      >
        <div className="size-8 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-gray-300 shrink-0"
             style={userColor ? { backgroundColor: userColor, color: '#fff' } : {}}
        >
          {profileLabel.charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-sm font-medium truncate text-slate-900 dark:text-gray-200">{profileLabel}</p>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {showUserMenu && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-xl rounded-md overflow-hidden z-50 min-w-[240px] max-h-[70vh] overflow-y-auto custom-scrollbar"
             role="menu">
          
          {setUserColor && (
            <>
              <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Current colour:</span>
                <button
                  onClick={() => setIsColorModalOpen(true)}
                  className="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-gray-600 transition-transform hover:scale-110 shadow-sm cursor-pointer"
                  title="Change colour"
                  aria-label="Change colour"
                />
              </div>
              <ColorPickerModal
                isOpen={isColorModalOpen}
                onClose={() => setIsColorModalOpen(false)}
                currentColor={userColor}
                onSelectColor={setUserColor}
              />
            </>
          )}

          <button
            onClick={() => { setShowUserMenu(false); setIsAchievementsModalOpen(true) }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-gray-200 hover:bg-brand-50 dark:hover:bg-brand-800/40 flex items-center gap-2 hidden"
            role="menuitem"
          >
            Achievements
          </button>
          <AchievementsModal
            isOpen={isAchievementsModalOpen}
            onClose={() => setIsAchievementsModalOpen(false)}
          />
          <button
            onClick={() => { setShowUserMenu(false); navigate('/settings') }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-gray-200 hover:bg-brand-50 dark:hover:bg-brand-800/40 flex items-center gap-2"
            role="menuitem"
          >
            Settings
          </button>
          <button
            onClick={() => { setShowUserMenu(false); signOut().then(() => navigate('/')) }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-800/40 flex items-center gap-2 border-t border-slate-100 dark:border-gray-700 text-red-600 dark:text-red-400"
            role="menuitem"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
