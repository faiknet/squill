const STORAGE_KEY = 'squill:achievements'
const GUEST_STORAGE_KEY = 'squill_guest_achievements'

export const ACHIEVEMENT_DEFINITIONS = [
  { slug: 'first-session', name: 'First Session', description: 'Create your first session', icon: '📝', category: 'sessions', criteria_type: 'session_count', criteria_value: 1 },
  { slug: 'three-sessions', name: 'Dedicated Scribe', description: 'Create 3 sessions', icon: '📚', category: 'sessions', criteria_type: 'session_count', criteria_value: 3 },
  { slug: 'first-campaign', name: 'World Builder', description: 'Create your first campaign', icon: '🌍', category: 'campaigns', criteria_type: 'campaign_count', criteria_value: 1 },
  { slug: 'week-streak', name: 'Weekly Warrior', description: 'Maintain a 7-day activity streak', icon: '🔥', category: 'streaks', criteria_type: 'streak_count', criteria_value: 7 },
  { slug: 'first-journal', name: 'Journal Keeper', description: 'Write your first journal entry', icon: '📖', category: 'journal', criteria_type: 'journal_count', criteria_value: 1 },
  { slug: 'first-npc', name: 'Storyteller', description: 'Create your first NPC', icon: '🧙', category: 'entities', criteria_type: 'npc_count', criteria_value: 1 },
  { slug: 'invite-player', name: "Party's Here", description: 'Invite your first player', icon: '👋', category: 'social', criteria_type: 'invite_count', criteria_value: 1 },
]

export function getStoredAchievements(isGuest = false) {
  if (typeof window === 'undefined') return []
  const key = isGuest ? GUEST_STORAGE_KEY : STORAGE_KEY
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function setStoredAchievement(slug, data, isGuest = false) {
  if (typeof window === 'undefined') return
  const key = isGuest ? GUEST_STORAGE_KEY : STORAGE_KEY
  const achievements = getStoredAchievements(isGuest)
  const idx = achievements.findIndex((a) => a.slug === slug)
  if (idx >= 0) {
    achievements[idx] = { ...achievements[idx], ...data }
  } else {
    achievements.push({ slug, ...data })
  }
  window.localStorage.setItem(key, JSON.stringify(achievements))
}

export function clearStoredAchievements(isGuest = false) {
  if (typeof window === 'undefined') return
  const key = isGuest ? GUEST_STORAGE_KEY : STORAGE_KEY
  window.localStorage.removeItem(key)
}
