import { useState } from 'react'
import { Card, Button } from '../ui'

export default function LeaveCampaignModal({ isOpen, onClose, onConfirm, campaignName }) {
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleLeave = async () => {
    setLoading(true)
    await onConfirm()
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 shadow-sm">
        <div className="border-b border-red-200 dark:border-red-900/50 p-6">
          <h2 className="text-lg font-bold text-red-600 dark:text-red-500 tracking-tight">Leave Campaign</h2>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Are you sure you want to leave <span className="font-medium text-slate-900 dark:text-gray-100">{campaignName}</span>? You will lose access to all sessions and notes, and you will need to be re-invited to the campaign if you wish to join again.
          </p>
          
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLeave}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white font-medium animate-none"
            >
              {loading ? 'Leaving...' : 'Leave Campaign'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
