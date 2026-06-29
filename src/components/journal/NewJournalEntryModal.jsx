import { useState } from 'react'
import { Modal, Button, Input } from '../ui'

export default function NewJournalEntryModal({ isOpen, onClose, onSave, sectionType, sectionTitle }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setLoading(true)
    try {
      await onSave(name.trim())
      setName('')
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create entry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`New ${sectionTitle}`} size="md">
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Name
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Enter ${sectionTitle} name`}
            autoFocus
            disabled={loading}
            className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-gray-700/50">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-sm"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !name.trim()}
          >
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
