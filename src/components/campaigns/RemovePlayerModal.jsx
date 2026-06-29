import { useState } from 'react'
import { ConfirmationModal } from '../ui'

export default function RemovePlayerModal({ isOpen, onClose, onConfirm, playerName }) {
  const [loading, setLoading] = useState(false)

  const handleRemove = async () => {
    setLoading(true)
    await onConfirm()
    setLoading(false)
    onClose()
  }

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleRemove}
      title="Remove Player"
      message={`Are you sure you want to remove ${playerName} from the campaign? They will lose access to all sessions and notes.`}
      confirmText="Remove Player"
      loading={loading}
      variant="danger"
    />
  )
}
