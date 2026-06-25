import { Card, Button } from '../ui'

export default function GMLeaveWarningModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/50 shadow-sm">
        <div className="border-b border-amber-200 dark:border-amber-900/50 p-6">
          <h2 className="text-lg font-bold text-amber-600 dark:text-amber-500 tracking-tight">Cannot Leave Campaign</h2>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            You are the Game Master of this campaign. Transfer GM status to another player before leaving.
          </p>
          
          <div className="flex justify-end">
            <Button
              onClick={onClose}
              className="bg-[#265d5c] hover:bg-[#1f4b4a] text-white font-medium px-4"
            >
              Got it
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
