import { useEffect, useState } from 'react'
import { Button, Card } from '../ui'
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

  useEffect(() => {
    if (isOpen) {
      setSelectedFormat('docx')
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-xl rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-gray-100">Export Session Notes</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
            Choose an export format for <span className="font-medium">{sessionName || 'this session'}</span>.
          </p>

          <div className="mt-5 space-y-2">
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

          {!hasContent && (
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
              Notes are currently empty. Add content before exporting.
            </p>
          )}
          {exportError && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{exportError}</p>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 dark:border-gray-700/50 pt-4">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onExport(selectedFormat)}
              disabled={isExporting || !hasContent}
              className="bg-brand-600 text-white hover:bg-brand-700 shadow-sm min-w-[132px]"
            >
              {isExporting ? 'Exporting...' : 'Export Notes'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
