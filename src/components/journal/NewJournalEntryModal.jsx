import { useState } from 'react'
import { Card, Button, Input } from '../ui'

export default function NewJournalEntryModal({ isOpen, onClose, onSave, sectionType, sectionTitle }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-xl rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-gray-100 mb-6">
            New {sectionTitle}
          </h2>

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
                className="bg-brand-600 text-white hover:bg-brand-700 text-sm"
                disabled={loading || !name.trim()}
              >
                {loading ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  )
}
