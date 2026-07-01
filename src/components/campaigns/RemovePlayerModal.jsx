import { useState } from 'react'
import { Modal, Button } from '../ui'

export default function RemovePlayerModal({ isOpen, onClose, onConfirm, playerName }) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleRemove = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to remove player. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Remove Player" size="md">
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 text-sm" role="alert">
            {errorMessage}
          </div>
        )}
        <p className="text-sm text-slate-600 dark:text-gray-300">
          Are you sure you want to remove {playerName} from the campaign? They will lose access to all sessions and notes.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRemove} disabled={loading}>
            {loading ? 'Removing...' : 'Remove Player'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
