export const SESSION_EDITOR_COLOR_STORAGE_KEY = 'squill:session-editor:user-color'

export const USER_COLOR_OPTIONS = [
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

export const DEFAULT_EDITOR_USER_COLOR = USER_COLOR_OPTIONS[4].value

export function getEditorUserColorPreference() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(SESSION_EDITOR_COLOR_STORAGE_KEY) || ''
}

export function setEditorUserColorPreference(color) {
  if (typeof window === 'undefined') return
  if (color) {
    window.localStorage.setItem(SESSION_EDITOR_COLOR_STORAGE_KEY, color)
    return
  }
  window.localStorage.removeItem(SESSION_EDITOR_COLOR_STORAGE_KEY)
}
