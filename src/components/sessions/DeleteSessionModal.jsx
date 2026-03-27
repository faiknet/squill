import { useState } from 'react'
import { Card, Button } from '../ui'

export default function DeleteSessionModal({ isOpen, onClose, onDelete, sessionName }) {
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleDelete = async () => {
    setLoading(true)
    await onDelete()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 shadow-sm">
        <div className="border-b border-red-200 dark:border-red-900/50 p-6">
          <h2 className="text-lg font-bold text-red-600 dark:text-red-500 tracking-tight">Delete Session</h2>
        </div>
        <div className="p-6">
          <p className="mb-6 text-sm text-slate-600 dark:text-gray-400">
            This action cannot be undone. The session
            <span className="font-medium text-slate-900 dark:text-gray-100"> "{sessionName}" </span>
            and all of its notes will be permanently deleted.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
              Cancel
            </Button>
            <Button 
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {loading ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
