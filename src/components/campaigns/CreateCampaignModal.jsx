import { useState } from 'react'
import { Card, Button, Input } from '../ui'

export default function CreateCampaignModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await onCreate({ name, description })
    setLoading(false)
    setName('')
    setDescription('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="border-b border-slate-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100 tracking-tight">Create New Campaign</h2>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Campaign Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., The Curse of Strahd"
                required
                className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Description</label>
              <textarea
                className="w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief summary of your adventure..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" type="button" onClick={onClose} className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
                Cancel
              </Button>
              <Button type="submit" className="bg-brand-600 text-white hover:bg-brand-700 font-medium" disabled={loading || !name.trim()}>
                {loading ? 'Creating...' : 'Create Campaign'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  )
}
