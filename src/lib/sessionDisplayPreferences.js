export const SHOW_OFFLINE_MEMBERS_STORAGE_KEY = 'squill:preferences:member-list:show-offline'
export const DEFAULT_SHOW_OFFLINE_MEMBERS = true

export function getShowOfflineMembersPreference() {
  if (typeof window === 'undefined') return DEFAULT_SHOW_OFFLINE_MEMBERS
  const raw = window.localStorage.getItem(SHOW_OFFLINE_MEMBERS_STORAGE_KEY)
  if (raw === null) return DEFAULT_SHOW_OFFLINE_MEMBERS
  return raw === 'true'
}

export function setShowOfflineMembersPreference(value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SHOW_OFFLINE_MEMBERS_STORAGE_KEY, String(Boolean(value)))
}
