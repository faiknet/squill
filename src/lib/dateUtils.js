export function formatDistanceToNowCustom(date, options = {}) {
  const now = new Date()
  const diffInSeconds = Math.round((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return options.addSuffix ? 'just now' : 'less than a minute'
  }
  
  const diffInMinutes = Math.round(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    const val = `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'}`
    return options.addSuffix ? `${val} ago` : val
  }
  
  const diffInHours = Math.round(diffInMinutes / 60)
  if (diffInHours < 24) {
    const val = `${diffInHours} hour${diffInHours === 1 ? '' : 's'}`
    return options.addSuffix ? `${val} ago` : val
  }
  
  const diffInDays = Math.round(diffInHours / 24)
  if (diffInDays < 30) {
    const val = `${diffInDays} day${diffInDays === 1 ? '' : 's'}`
    return options.addSuffix ? `${val} ago` : val
  }
  
  const diffInMonths = Math.round(diffInDays / 30)
  if (diffInMonths < 12) {
    const val = `${diffInMonths} month${diffInMonths === 1 ? '' : 's'}`
    return options.addSuffix ? `${val} ago` : val
  }
  
  const diffInYears = Math.round(diffInDays / 365)
  const val = `${diffInYears} year${diffInYears === 1 ? '' : 's'}`
  return options.addSuffix ? `${val} ago` : val
}

export function formatDatePPP(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}
