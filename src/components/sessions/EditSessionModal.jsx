import { useState, useEffect } from 'react'
import { Modal, Button, Input } from '../ui'

export default function EditSessionModal({ isOpen, onClose, onSave, session }) {
  const [name, setName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  useEffect(() => {
    if (session) {
      setName(session.name)
      if (session.session_date) {
        setSessionDate(session.session_date.split('T')[0])
      } else {
        setSessionDate('')
      }
    }
    setErrorMessage('')
    setNameTouched(false)
  }, [session])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    try {
      const updateData = { 
        name, 
        session_date: sessionDate || null 
      }
      await onSave(session.id, updateData)
      onClose()
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to save session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen && !!session} onClose={onClose} title="Edit Session" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 text-sm" role="alert">
            {errorMessage}
          </div>
        )}
        <div>
          <label htmlFor="edit-session-name" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
            Session Name
          </label>
          <Input
            id="edit-session-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            placeholder="e.g., Session 1: The Beginning"
            required
            className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 w-full"
          />
          {nameTouched && !name.trim() && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">Session name is required</p>
          )}
        </div>
        <div>
          <label htmlFor="edit-session-date" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
            Session Date
          </label>
          <Input
            id="edit-session-date"
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 w-full"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-gray-700/50 mt-6">
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
