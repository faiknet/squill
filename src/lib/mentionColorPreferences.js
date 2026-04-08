export const NPC_REFERENCE_MENTION_COLOR_STORAGE_KEY = 'squill:preferences:mention-color:npc-reference'
export const ITEM_REFERENCE_MENTION_COLOR_STORAGE_KEY = 'squill:preferences:mention-color:item-reference'
export const PET_REFERENCE_MENTION_COLOR_STORAGE_KEY = 'squill:preferences:mention-color:pet-reference'
export const LOCATION_REFERENCE_MENTION_COLOR_STORAGE_KEY = 'squill:preferences:mention-color:location-reference'
export const SESSION_REFERENCE_MENTION_COLOR_STORAGE_KEY = 'squill:preferences:mention-color:session-reference'

export const DEFAULT_NPC_REFERENCE_MENTION_COLOR = '#3b82f6'
export const DEFAULT_ITEM_REFERENCE_MENTION_COLOR = '#a16207'
export const DEFAULT_PET_REFERENCE_MENTION_COLOR = '#a855f7'
export const DEFAULT_LOCATION_REFERENCE_MENTION_COLOR = '#22c55e'
export const DEFAULT_SESSION_REFERENCE_MENTION_COLOR = '#ef4444'

function isValidHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())
}

function readColorPreference(storageKey) {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(storageKey)
  return isValidHexColor(value) ? value.toLowerCase() : null
}

export function getMentionColorPreferences() {
  return {
    npcReferenceColor: readColorPreference(NPC_REFERENCE_MENTION_COLOR_STORAGE_KEY),
    itemReferenceColor: readColorPreference(ITEM_REFERENCE_MENTION_COLOR_STORAGE_KEY),
    petReferenceColor: readColorPreference(PET_REFERENCE_MENTION_COLOR_STORAGE_KEY),
    locationReferenceColor: readColorPreference(LOCATION_REFERENCE_MENTION_COLOR_STORAGE_KEY),
    sessionReferenceColor: readColorPreference(SESSION_REFERENCE_MENTION_COLOR_STORAGE_KEY),
  }
}

export function setMentionColorPreference(storageKey, color) {
  if (typeof window === 'undefined') return
  if (isValidHexColor(color)) {
    window.localStorage.setItem(storageKey, color.toLowerCase())
  } else {
    window.localStorage.removeItem(storageKey)
  }
}

function applySinglePreference(root, attribute, cssVar, color) {
  if (color) {
    root.style.setProperty(cssVar, color)
    root.setAttribute(attribute, 'true')
  } else {
    root.style.removeProperty(cssVar)
    root.removeAttribute(attribute)
  }
}

export function applyMentionColorPreferences() {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const {
    npcReferenceColor,
    itemReferenceColor,
    petReferenceColor,
    locationReferenceColor,
    sessionReferenceColor,
  } = getMentionColorPreferences()

  applySinglePreference(
    root,
    'data-npc-reference-mention-custom-color',
    '--npc-reference-mention-color',
    npcReferenceColor
  )
  applySinglePreference(
    root,
    'data-item-reference-mention-custom-color',
    '--item-reference-mention-color',
    itemReferenceColor
  )
  applySinglePreference(
    root,
    'data-pet-reference-mention-custom-color',
    '--pet-reference-mention-color',
    petReferenceColor
  )
  applySinglePreference(
    root,
    'data-location-reference-mention-custom-color',
    '--location-reference-mention-color',
    locationReferenceColor
  )
  applySinglePreference(
    root,
    'data-session-reference-mention-custom-color',
    '--session-reference-mention-color',
    sessionReferenceColor
  )
}
