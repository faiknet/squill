import { useState } from 'react'
import { Modal, Button, Input } from '../ui'

export default function DeleteCampaignModal({ isOpen, onClose, onDelete, campaignName }) {
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (confirmText !== campaignName) return
    setLoading(true)
    await onDelete()
    setLoading(false)
    setConfirmText('')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Campaign" size="md">
      <div className="space-y-6">
        <p className="text-sm text-slate-600 dark:text-gray-400">
          This action cannot be undone. All sessions, notes, and data associated with 
          <span className="font-medium text-slate-900 dark:text-gray-100"> {campaignName} </span> 
          will be permanently deleted.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Type <span className="font-mono text-slate-600 dark:text-gray-400">{campaignName}</span> to confirm
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={campaignName}
            className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-red-500 focus:border-red-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="danger"
            onClick={handleDelete}
            disabled={loading || confirmText !== campaignName}
          >
            {loading ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
