import { useState, useEffect } from 'react'
import { Modal, Button, Input } from '../ui'

export default function EditCampaignModal({ isOpen, onClose, onSave, campaign }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  useEffect(() => {
    if (campaign) {
      setName(campaign.name)
      setDescription(campaign.description || '')
    }
    setErrorMessage('')
    setNameTouched(false)
  }, [campaign])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')
    try {
      await onSave(campaign.id, { name, description })
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to update campaign. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen && !!campaign} onClose={onClose} title="Edit Campaign" size="md">
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 text-sm" role="alert">
            {errorMessage}
          </div>
        )}
        <div>
          <label htmlFor="edit-campaign-name" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Campaign Name</label>
          <Input
            id="edit-campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            placeholder="Campaign Name"
            required
            className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
          />
          {nameTouched && !name.trim() && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">Campaign name is required</p>
          )}
        </div>
        <div>
          <label htmlFor="edit-campaign-description" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Description</label>
          <textarea
            id="edit-campaign-description"
            className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
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
