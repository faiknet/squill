import { useEffect } from 'react'
import { useDarkMode } from '../hooks/useDarkMode'

export function DarkModeProvider({ children }) {
  // Initialize dark mode from localStorage on app mount
  useDarkMode()
  
  return children
}
