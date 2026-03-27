import { useState } from 'react'
import { Card, Button } from '../ui'

export default function PartyMemberActionModal({ isOpen, onClose, onRemove, onTransferGM, member, isCurrentUserGM, isCurrentMemberGM }) {
  const [loading, setLoading] = useState(false)

  if (!isOpen || !member) return null

  const handleRemove = async () => {
    setLoading(true)
    await onRemove(member.user_id)
    setLoading(false)
    onClose()
  }

  const handleTransferGM = async () => {
    setLoading(true)
    await onTransferGM(member.user_id)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="border-b border-slate-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100 tracking-tight">
            Manage {member.display_name}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {isCurrentUserGM && !isCurrentMemberGM && (
            <>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                You can remove this player from the campaign or transfer your GM status to them.
              </p>
              
              <div className="space-y-3">
                {!isCurrentMemberGM && (
                  <Button
                    onClick={handleTransferGM}
                    disabled={loading}
                    className="w-full bg-brand-600 text-white hover:bg-brand-700 font-medium"
                  >
                    {loading ? 'Transferring...' : 'Transfer GM Status'}
                  </Button>
                )}
                
                <Button
                  onClick={handleRemove}
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  {loading ? 'Removing...' : 'Remove from Campaign'}
                </Button>
              </div>
            </>
          )}

          {isCurrentMemberGM && (
            <p className="text-sm text-slate-600 dark:text-gray-400">
              {isCurrentUserGM 
                ? "You are the Game Master. Transfer your GM status to another player first before removing yourself."
                : "This player is the Game Master."}
            </p>
          )}

          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
          >
            Close
          </Button>
        </div>
      </Card>
    </div>
  )
}
