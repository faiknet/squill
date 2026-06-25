export const JOURNAL_ENTRY_TYPE_OPTIONS = {
  npc: ['Ally/Companion', 'Adversary/Enemy', 'Major NPC', 'Minor NPC'],
  inventory: ['Armour', 'Consumable', 'Magic Item', 'Misc', 'Tool', 'Weapon'],
  pet: ['Bird', 'Cat', 'Camel', 'Dog', 'Elephant', 'Horse', 'Other'],
  location: ['Arctic', 'Aquatic', 'Coast', 'Desert', 'Forest', 'Grassland', 'Mountain', 'Swamp', 'Urban', 'Subterranean', 'Other'],
}

export const SECTION_TO_TAG_TYPE = {
  npc: 'npc',
  inventory: 'item',
  pet: 'pet',
  location: 'location',
}

export function normalizeSectionTypeToTagType(sectionType) {
  return SECTION_TO_TAG_TYPE[sectionType] || sectionType
}

export function normalizeTagTypeToSectionType(tagType) {
  if (tagType === 'item') return 'inventory'
  return tagType
}

export function getJournalEntryTypeOptionsForSection(sectionType) {
  return JOURNAL_ENTRY_TYPE_OPTIONS[sectionType] || []
}

export function getDefaultJournalEntryTypeForSection(sectionType) {
  return getJournalEntryTypeOptionsForSection(sectionType)[0] || ''
}

export function isValidJournalEntryTypeForSection(sectionType, entryType) {
  if (!entryType) return false
  return getJournalEntryTypeOptionsForSection(sectionType).includes(entryType)
}
