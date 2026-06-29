import { Modal, Button } from '../ui'

export default function GMLeaveWarningModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cannot Leave Campaign" size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-gray-400">
          You are the Game Master of this campaign. Transfer GM status to another player before leaving.
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose} variant="primary" className="px-4">
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  )
}
