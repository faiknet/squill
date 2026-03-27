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
