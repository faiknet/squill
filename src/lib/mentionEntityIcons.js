const DEFAULT_ENTITY_ICON_MAP = {
  npc: '/icons/NPCs.png',
  item: '/icons/Inventory.png',
  pet: '/icons/Pets.png',
  location: '/icons/Location.png',
}

const PET_ENTRY_TYPE_ICON_MAP = {
  bird: '/icons/journal/bird.svg',
  camel: '/icons/journal/camel.svg',
  dog: '/icons/journal/dog.svg',
  elephant: '/icons/journal/elephant.svg',
  horse: '/icons/journal/horse.svg',
}

function normalizeEntryType(entryType) {
  return String(entryType || '').trim().toLowerCase()
}

export function getPetMentionEntryTypeKey(entryType) {
  const normalized = normalizeEntryType(entryType)
  return PET_ENTRY_TYPE_ICON_MAP[normalized] ? normalized : ''
}

export function getMentionEntityIcon(entityType, entryType) {
  if (entityType === 'pet') {
    const key = getPetMentionEntryTypeKey(entryType)
    if (key) return PET_ENTRY_TYPE_ICON_MAP[key]
  }
  return DEFAULT_ENTITY_ICON_MAP[entityType] || DEFAULT_ENTITY_ICON_MAP.npc
}
