import { useState } from 'react'
import { Card, Button } from '../ui'

export default function TransferGMModal({ isOpen, onClose, onConfirm, playerName }) {
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleTransfer = async () => {
    setLoading(true)
    await onConfirm()
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="border-b border-slate-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100 tracking-tight">Transfer GM Status</h2>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Are you sure you want to transfer Game Master status to <span className="font-medium text-slate-900 dark:text-gray-100">{playerName}</span>? You will no longer be able to manage the campaign.
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
              onClick={handleTransfer}
              disabled={loading}
              className="bg-brand-600 hover:bg-brand-700 text-white font-medium"
            >
              {loading ? 'Transferring...' : 'Transfer GM Status'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
