import { useState, useRef } from 'react'
import { Modal, Button } from '../ui'

// Helper to optimize Supabase Storage URLs by leveraging on-the-fly transformations
function optimizeImageUrl(url) {
  if (!url) return url
  const supabasePattern = /^(https:\/\/[\w-]+\.supabase\.co)\/storage\/v1\/object\/public\/([^\s\?]+)/
  const match = url.match(supabasePattern)
  if (match) {
    const baseUrl = match[1]
    const path = match[2]
    const hasParams = url.includes('?')
    if (!hasParams) {
      return `${baseUrl}/storage/v1/render/image/public/${path}?width=800&quality=80`
    }
  }
  return url
}

// Client-side image compression to downscale large image uploads and reduce base64 size
function compressImage(file, maxWidth = 1000, maxHeight = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(compressedDataUrl)
      }
      img.onerror = (err) => reject(err)
    }
    reader.onerror = (err) => reject(err)
  })
}

export default function ImageModal({ isOpen, onClose, onInsert }) {
  const [imageUrl, setImageUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('url') // 'url' or 'upload'
  const fileInputRef = useRef(null)

  const handleUrlSubmit = (e) => {
    e.preventDefault()
    if (imageUrl.trim()) {
      onInsert(optimizeImageUrl(imageUrl.trim()))
      setImageUrl('')
      onClose()
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    setIsUploading(true)

    try {
      const compressedDataUrl = await compressImage(file)
      onInsert(compressedDataUrl)
      setIsUploading(false)
      onClose()
    } catch (error) {
      console.error('Error compressing/uploading image:', error)
      alert('Failed to process image')
      setIsUploading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Insert Image" size="md">
      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'url'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
          }`}
        >
          From URL
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'upload'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
          }`}
        >
          Upload File
        </button>
      </div>

      {/* URL Tab */}
      {activeTab === 'url' && (
        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-gray-300">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100"
              autoFocus
              required
            />
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Insert
            </Button>
          </div>
        </form>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-gray-300">
              Select Image File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
              disabled={isUploading}
            />
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
              Large images will be optimized/resized automatically to ensure fast synchronization.
            </p>
          </div>
          
          {isUploading && (
            <div className="text-center py-4 text-slate-600 dark:text-gray-400">
              Optimizing image...
            </div>
          )}
          
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
