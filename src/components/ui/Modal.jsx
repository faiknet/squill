import { useEffect, useId } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import Card from './Card'

export default function Modal({ isOpen, onClose, title, size = 'md', children, className = '', showCloseButton = true }) {
  const titleId = useId()
  const focusTrapRef = useFocusTrap(isOpen, onClose)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }

  const sizeClass = sizes[size] || sizes.md

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <Card
        ref={focusTrapRef}
        className={`w-full ${sizeClass} bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-xl rounded-xl overflow-hidden flex flex-col ${className}`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-700 px-6 py-4">
            <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-gray-100 tracking-tight">
              {title}
            </h2>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="p-6 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {children}
        </div>
      </Card>
    </div>
  )
}
