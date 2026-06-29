import { useState } from 'react'
import { ConfirmationModal } from '../ui'

export default function LeaveCampaignModal({ isOpen, onClose, onConfirm, campaignName }) {
  const [loading, setLoading] = useState(false)

  const handleLeave = async () => {
    setLoading(true)
    await onConfirm()
    setLoading(false)
    onClose()
  }

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleLeave}
      title="Leave Campaign"
      message={`Are you sure you want to leave ${campaignName}? You will lose access to all sessions and notes, and you will need to be re-invited to the campaign if you wish to join again.`}
      confirmText="Leave Campaign"
      loading={loading}
      variant="danger"
    />
  )
}
