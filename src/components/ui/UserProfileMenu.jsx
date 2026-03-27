import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useSupabaseAuth'
import { getDisplayLabel } from '../../lib/utils'

const USER_COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#f59e0b', label: 'Yellow' },
  { value: '#84cc16', label: 'Green' },
  { value: '#10b981', label: 'Teal' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f43f5e', label: 'Rose' },
]

export default function UserProfileMenu({ collapsed = false, userColor, setUserColor }) {
  const navigate = useNavigate()
  const { authState, signOut } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
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
        className={`w-full flex items-center gap-2.5 p-1.5 hover:bg-slate-50 dark:hover:bg-gray-800/50 rounded-md cursor-pointer transition-colors ${collapsed ? 'justify-center' : ''}`}
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
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {showUserMenu && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-xl rounded-md overflow-hidden z-50 min-w-[240px]">
          
          {setUserColor && (
            <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
              <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Colour</p>
              <div className="grid grid-cols-5 gap-2">
                {USER_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setUserColor(option.value)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      userColor === option.value ? 'border-slate-900 ring-1 ring-slate-900/20 dark:border-white dark:ring-white/20' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: option.value }}
                    title={option.label}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setShowUserMenu(false); navigate('/settings') }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 flex items-center gap-2"
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
  )
}
