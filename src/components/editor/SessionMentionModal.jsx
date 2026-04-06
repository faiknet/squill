import { useEffect, useMemo, useRef } from 'react'
import { format } from 'date-fns'

function formatSessionDate(session) {
  const rawValue = session?.session_date || session?.created_at
  if (!rawValue) return 'Unknown'

  const date = new Date(rawValue)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return format(date, 'PPP')
}

export default function SessionMentionModal({ session, anchorRect, campaignSlug, onClose }) {
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!session) return undefined

    const handlePointerDown = (event) => {
      if (popoverRef.current?.contains(event.target)) return
      onClose()
    }

    const handleKeyDown = () => {
      onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [session, onClose])

  const position = useMemo(() => {
    if (!anchorRect || typeof window === 'undefined') {
      return { top: 16, left: 16 }
    }

    const popoverWidth = 260
    const estimatedHeight = 125
    const margin = 8
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let left = Math.min(
      Math.max(anchorRect.left, margin),
      viewportWidth - popoverWidth - margin
    )

    let top = anchorRect.bottom + margin
    if (top + estimatedHeight > viewportHeight - margin) {
      top = Math.max(margin, anchorRect.top - estimatedHeight - margin)
    }

    if (left < margin) left = margin

    return { top, left }
  }, [anchorRect])

  const jumpHref = useMemo(() => {
    if (!session || !campaignSlug) return null
    const targetSession = session.slug || session.id
    if (!targetSession) return null
    return `/campaigns/${campaignSlug}/sessions/${targetSession}`
  }, [session, campaignSlug])

  if (!session) return null

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[16.25rem] max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-xl rounded-lg p-4"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="space-y-2 text-xs">

        <div>
          <p className="text-slate-500 dark:text-gray-400">Date</p>
          <p className="font-medium text-slate-900 dark:text-gray-100">{formatSessionDate(session)}</p>
        </div>
        {jumpHref && (
          <div>
            <a
              href={jumpHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium underline"
            >
              Jump
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
