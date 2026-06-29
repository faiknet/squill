import { useState } from 'react'
import { ConfirmationModal } from '../ui'

export default function DeleteSessionModal({ isOpen, onClose, onDelete, sessionName }) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    await onDelete()
    setLoading(false)
  }

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title="Delete Session"
      message={`This action cannot be undone. The session "${sessionName}" and all of its notes will be permanently deleted.`}
      confirmText="Delete Permanently"
      loading={loading}
      variant="danger"
    />
  )
}
