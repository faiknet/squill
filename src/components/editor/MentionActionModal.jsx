import { useEffect, useMemo, useRef } from 'react'
import { formatDatePPP, formatDistanceToNowCustom } from '../../lib/dateUtils'

function formatSessionDate(session) {
  const rawValue = session?.session_date || session?.created_at
  if (!rawValue) return 'Unknown'
  const date = new Date(rawValue)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return formatDatePPP(date)
}

function formatEntryType(type) {
  if (!type) return 'Unknown'
  if (type === 'item') return 'Inventory'
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`
}

function formatSessionAdded(entry) {
  const sessionName = entry?.sessions?.name || 'Unknown Session'
  if (!entry?.created_at) {
    return `Added recently in ${sessionName}`
  }
  try {
    const distance = formatDistanceToNowCustom(new Date(entry.created_at), { addSuffix: true })
      .replace('about ', '')
    return `Added ${distance} in ${sessionName}`
  } catch {
    return `Added recently in ${sessionName}`
  }
}

export default function MentionActionModal({ type, data, anchorRect, campaignSlug, onClose }) {
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!data) return undefined

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
  }, [data, onClose])

  const position = useMemo(() => {
    if (!anchorRect || typeof window === 'undefined') {
      return { top: 16, left: 16 }
    }

    const popoverWidth = type === 'session' ? 260 : 280
    const estimatedHeight = type === 'session' ? 125 : 170
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
  }, [anchorRect, type])

  const teleportHref = useMemo(() => {
    if (type !== 'session' || !data || !campaignSlug) return null
    const targetSession = data.slug || data.id
    if (!targetSession) return null
    return `/campaigns/${campaignSlug}/sessions/${targetSession}`
  }, [type, data, campaignSlug])

  if (!data) return null

  return (
    <div
      ref={popoverRef}
      className={`fixed z-50 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-xl rounded-lg p-4 animate-fadeIn ${
        type === 'session' ? 'w-[16.25rem]' : 'w-[17.5rem]'
      }`}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="space-y-2 text-xs">
        {type === 'session' ? (
          <>
            <div>
              <p className="text-slate-500 dark:text-gray-400">Date</p>
              <p className="font-medium text-slate-900 dark:text-gray-100">{formatSessionDate(data)}</p>
            </div>
            {teleportHref && (
              <div>
                <a
                  href={teleportHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium underline"
                >
                  Teleport
                </a>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <p className="text-slate-500 dark:text-gray-400">Name</p>
              <p className="font-medium text-slate-900 dark:text-gray-100">{data.label || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-gray-400">Type</p>
              <p className="font-medium text-slate-900 dark:text-gray-100">{formatEntryType(data.tag_type)}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-gray-400">Session Added</p>
              <p className="font-medium text-slate-900 dark:text-gray-100">{formatSessionAdded(data)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
