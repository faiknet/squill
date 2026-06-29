import { useState } from 'react'
import { ConfirmationModal } from '../ui'

export default function TransferGMModal({ isOpen, onClose, onConfirm, playerName }) {
  const [loading, setLoading] = useState(false)

  const handleTransfer = async () => {
    setLoading(true)
    await onConfirm()
    setLoading(false)
    onClose()
  }

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleTransfer}
      title="Transfer GM Status"
      message={`Are you sure you want to transfer Game Master status to ${playerName}? You will no longer be able to manage the campaign.`}
      confirmText="Transfer GM Status"
      loading={loading}
      variant="primary"
    />
  )
}
