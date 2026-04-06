import { useEffect, useMemo, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'

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
    const distance = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })
      .replace('about ', '')
    return `Added ${distance} in ${sessionName}`
  } catch {
    return `Added recently in ${sessionName}`
  }
}

export default function JournalEntryMentionModal({ entry, anchorRect, onClose }) {
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!entry) return undefined

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
  }, [entry, onClose])

  const position = useMemo(() => {
    if (!anchorRect || typeof window === 'undefined') {
      return { top: 16, left: 16 }
    }

    const popoverWidth = 280
    const estimatedHeight = 170
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

  if (!entry) return null

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[17.5rem] max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-xl rounded-lg p-4"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >


      <div className="space-y-2 text-xs">
        <div>
          <p className="text-slate-500 dark:text-gray-400">Name</p>
          <p className="font-medium text-slate-900 dark:text-gray-100">{entry.label || 'Unknown'}</p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-gray-400">Type</p>
          <p className="font-medium text-slate-900 dark:text-gray-100">{formatEntryType(entry.tag_type)}</p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-gray-400">Session Added</p>
          <p className="font-medium text-slate-900 dark:text-gray-100">{formatSessionAdded(entry)}</p>
        </div>
      </div>
    </div>
  )
}
