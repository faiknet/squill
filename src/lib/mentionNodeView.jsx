import NPCsIcon from '../assets/icons/NPCs.png'
import InventoryIcon from '../assets/icons/Inventory.png'
import PetsIcon from '../assets/icons/Pets.png'
import LocationIcon from '../assets/icons/Location.png'

const TYPE_ICONS = {
  npc: NPCsIcon,
  item: InventoryIcon,
  pet: PetsIcon,
  location: LocationIcon,
}

const TYPE_COLORS = {
  npc: '#3b82f6',
  item: '#a16207',
  pet: '#a855f7',
  location: '#22c55e',
  session: '#ef4444',
}

const DARK_TYPE_COLORS = {
  npc: '#60a5fa',
  item: '#d97706',
  pet: '#c084fc',
  location: '#4ade80',
  session: '#f87171',
}

export const renderMention = (node, isDark = false) => {
  const mentionType = node.getAttribute('data-mention-type')
  const mentionEntityType = node.getAttribute('data-mention-entity-type')
  const mentionLabel = node.getAttribute('data-mention-label')
  const mentionColor = node.getAttribute('data-mention-color')
  const mentionId = node.getAttribute('data-mention-id')
  
  let color = TYPE_COLORS[mentionEntityType] || TYPE_COLORS[mentionType]
  if (isDark) {
    color = DARK_TYPE_COLORS[mentionEntityType] || DARK_TYPE_COLORS[mentionType]
  }
  
  let icon = null
  if (mentionType === 'entity') {
    icon = TYPE_ICONS[mentionEntityType]
  }
  
  if (mentionType === 'user' && mentionColor) {
    color = mentionColor
  }
  
  const styles = {
    color,
    fontWeight: 'bold',
  }
  
  if (mentionType === 'session') {
    styles.textDecoration = 'underline'
    styles.cursor = 'pointer'
  }
  
  node.style.color = color
  node.style.fontWeight = 'bold'
  if (mentionType === 'session') {
    node.style.textDecoration = 'underline'
    node.style.cursor = 'pointer'
  }
  
  return node
}
