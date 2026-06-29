import { useEffect, useState } from 'react'
import { Button, Modal } from '../ui'
import { SESSION_EXPORT_FORMATS } from '../../lib/sessionNoteExport'

export default function ExportSessionNotesModal({
  isOpen,
  onClose,
  onExport,
  sessionName,
  isExporting = false,
  exportError = '',
  hasContent = true,
}) {
  const [selectedFormat, setSelectedFormat] = useState('docx')
  const [keepJournalEntityFormatting, setKeepJournalEntityFormatting] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setSelectedFormat('docx')
      setKeepJournalEntityFormatting(true)
    }
  }, [isOpen])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Session Notes" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-gray-300">
          Choose an export format for <span className="font-medium">{sessionName || 'this session'}</span>.
        </p>

        <div className="space-y-2">
          {SESSION_EXPORT_FORMATS.map((format) => (
            <label
              key={format.value}
              className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 dark:border-gray-700 p-3 hover:bg-slate-50 dark:hover:bg-gray-700/50"
            >
              <input
                type="radio"
                name="session-note-export-format"
                value={format.value}
                checked={selectedFormat === format.value}
                onChange={() => setSelectedFormat(format.value)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-gray-100">{format.label}</span>
                <span className="block text-xs text-slate-600 dark:text-gray-300">{format.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={keepJournalEntityFormatting}
                onChange={(event) => setKeepJournalEntityFormatting(event.target.checked)}
                className="h-4 w-4"
              />
              <span>Keep Journal Entity formatting</span>
            </label>
            <span className="relative inline-flex h-6 w-6 items-center justify-center group">
              <img src="/icons/Help.svg" alt="" className="h-4 w-4 opacity-80" />
              <span
                role="tooltip"
                className="pointer-events-none absolute -top-2 right-0 z-10 w-72 -translate-y-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-snug text-slate-700 opacity-0 shadow-md transition-none group-hover:opacity-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                Uncheck to remove colours and icons from journal entities (NPCs, Inventory, Pets, Locations, Sessions, and Users)
              </span>
            </span>
          </div>
        </div>

        {!hasContent && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Notes are currently empty. Add content before exporting.
          </p>
        )}
        {exportError && (
          <p className="text-sm text-red-600 dark:text-red-400">{exportError}</p>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-gray-700/50 pt-4 mt-6">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onExport(selectedFormat, keepJournalEntityFormatting)}
            disabled={isExporting || !hasContent}
            className="min-w-[132px]"
          >
            {isExporting ? 'Exporting...' : 'Export Notes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
