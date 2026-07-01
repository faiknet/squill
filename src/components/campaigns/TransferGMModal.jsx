import { useState } from 'react'
import { Modal, Button } from '../ui'

export default function TransferGMModal({ isOpen, onClose, onConfirm, playerName }) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleTransfer = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to transfer GM status. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transfer GM Status" size="md">
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 text-sm" role="alert">
            {errorMessage}
          </div>
        )}
        <p className="text-sm text-slate-600 dark:text-gray-300">
          Are you sure you want to transfer Game Master status to {playerName}? You will no longer be able to manage the campaign.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleTransfer} disabled={loading}>
            {loading ? 'Transferring...' : 'Transfer GM Status'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
