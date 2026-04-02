export async function copyInviteLink(inviteCode, setConfirmation) {
  try {
    const link = `${window.location.origin}/join/${inviteCode}`
    await navigator.clipboard.writeText(link)
    setConfirmation(`Invite link copied: ${inviteCode}`)
    setTimeout(() => setConfirmation(''), 2000)
    return true
  } catch (err) {
    console.error('Failed to copy link:', err)
    return false
  }
}

export function getDisplayLabel(authState, defaultLabel = 'User') {
  if (!authState) return defaultLabel
  return authState.displayName || authState.user?.email?.split('@')[0] || defaultLabel
}

export function createUrlSlug(input, suffixLength = 4) {
  const normalized = (input || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const base = normalized || 'campaign'
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, suffixLength)
  return `${base}-${suffix}`
}
