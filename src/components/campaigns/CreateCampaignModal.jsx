import { useState, useEffect } from 'react'
import { Modal, Button, Input } from '../ui'

export default function CreateCampaignModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setDescription('')
      setErrorMessage('')
      setNameTouched(false)
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    try {
      await onCreate({ name, description })
      setName('')
      setDescription('')
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to create campaign. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Campaign" size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 text-sm" role="alert">
            {errorMessage}
          </div>
        )}
        <div>
          <label htmlFor="campaign-name" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Campaign Name</label>
          <Input
            id="campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            placeholder="e.g., The Curse of Strahd"
            required
            className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
          />
          {nameTouched && !name.trim() && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">Campaign name is required</p>
          )}
        </div>
        <div>
          <label htmlFor="campaign-description" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Description</label>
          <textarea
            id="campaign-description"
            className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief summary of your adventure..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? 'Creating...' : 'Create Campaign'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
