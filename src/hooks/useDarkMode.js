import { useEffect, useState } from 'react'

// Options: 'system' (default), 'light', 'dark'
export function useDarkMode() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme')
    return stored || 'system'
  })

  useEffect(() => {
    const root = window.document.documentElement
    
    let isDark = false
    if (theme === 'system') {
      // Check system preference
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    } else {
      isDark = theme === 'dark'
    }

    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  // Listen for system theme changes when set to 'system'
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      // Force re-render by updating theme
      setTheme('system')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return {
    theme,
    setTheme,
    isDark: theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  }
}

