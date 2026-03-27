import { useState } from 'react'
import { Card, Button, Input } from '../ui'

export default function DeleteCampaignModal({ isOpen, onClose, onDelete, campaignName }) {
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleDelete = async () => {
    if (confirmText !== campaignName) return
    setLoading(true)
    await onDelete()
    setLoading(false)
    setConfirmText('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 shadow-sm">
        <div className="border-b border-red-200 dark:border-red-900/50 p-6">
          <h2 className="text-lg font-bold text-red-600 dark:text-red-500 tracking-tight">Delete Campaign</h2>
        </div>
        <div className="p-6">
          <p className="mb-6 text-sm text-slate-600 dark:text-gray-400">
            This action cannot be undone. All sessions, notes, and data associated with 
            <span className="font-medium text-slate-900 dark:text-gray-100"> {campaignName} </span> 
            will be permanently deleted.
          </p>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Type <span className="font-mono text-slate-600 dark:text-gray-400">{campaignName}</span> to confirm
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={campaignName}
                className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose} className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
                Cancel
              </Button>
              <Button 
                onClick={handleDelete}
                disabled={loading || confirmText !== campaignName}
                className="bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                {loading ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
