import { useState, useEffect } from 'react'
import { Modal, Button } from '../ui'

export default function LinkModal({ isOpen, onClose, onInsert, currentUrl = '' }) {
  const [url, setUrl] = useState(currentUrl)

  useEffect(() => {
    if (isOpen) {
      setUrl(currentUrl)
    }
  }, [isOpen, currentUrl])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (url.trim()) {
      onInsert(url.trim())
      onClose()
    }
  }

  const handleRemove = () => {
    onInsert(null) // Signal to remove link
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={currentUrl ? 'Edit Link' : 'Insert Link'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="link-url" className="block text-sm font-medium mb-2 text-slate-700 dark:text-gray-300">
            URL
          </label>
          <input
            id="link-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100"
            required
          />
        </div>
        
        <div className="flex gap-2 justify-end pt-2">
          {currentUrl && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRemove}
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-transparent hover:border-transparent"
            >
              Remove Link
            </Button>
          )}
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {currentUrl ? 'Update' : 'Insert'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
