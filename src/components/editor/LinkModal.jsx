import { useState } from 'react'

export default function LinkModal({ isOpen, onClose, onInsert, currentUrl = '' }) {
  const [url, setUrl] = useState(currentUrl)

  if (!isOpen) return null

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-gray-100">
          {currentUrl ? 'Edit Link' : 'Insert Link'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-gray-300">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100"
              autoFocus
              required
            />
          </div>
          
          <div className="flex gap-2 justify-end">
            {currentUrl && (
              <button
                type="button"
                onClick={handleRemove}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              >
                Remove Link
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {currentUrl ? 'Update' : 'Insert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
