import { useState, useEffect } from 'react'
import { Card, Button, Input } from '../ui'

export default function EditSessionModal({ isOpen, onClose, onSave, session }) {
  const [name, setName] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session) {
      setName(session.name)
      if (session.session_date) {
        // Handle potentially different date formats or timezones
        const date = new Date(session.session_date)
        // Adjust for timezone offset to display correct date
        // const offset = date.getTimezoneOffset()
        // const adjustedDate = new Date(date.getTime() - (offset*60*1000))
        // setSessionDate(adjustedDate.toISOString().split('T')[0])
         setSessionDate(session.session_date.split('T')[0])
      } else {
        setSessionDate('')
      }
    }
  }, [session])

  if (!isOpen || !session) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const updateData = { 
        name, 
        session_date: sessionDate || null 
      }
      await onSave(session.id, updateData)
      onClose()
    } catch (error) {
      console.error('Failed to save session:', error)
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-gray-100 mb-6">Edit Session</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                Session Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Session 1: The Beginning"
                required
                className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                Session Date
              </label>
              <Input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 w-full"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-gray-700/50 mt-6">
              <Button 
                variant="outline" 
                type="button" 
                onClick={onClose} 
                disabled={loading}
                className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
                disabled={loading || !name.trim()}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  )
}
