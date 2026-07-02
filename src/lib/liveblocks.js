export function getSessionRoomId(campaignId, sessionId) {
  return `session-note:${campaignId}:${sessionId}`
}

const colorCache = new Map()

export function colorFromString(input) {
  if (!input) return '#3b82f6'
  if (colorCache.has(input)) {
    return colorCache.get(input)
  }
  const palette = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e']
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  const color = palette[Math.abs(hash) % palette.length]
  colorCache.set(input, color)
  return color
}
