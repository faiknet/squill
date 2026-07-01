import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { useEffect } from 'react'

export default function NotFound() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = '404 — Squill'
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 border-0 shadow-sm rounded-lg text-center p-6">
        <p className="text-sm font-medium text-gray-400 dark:text-gray-500 tracking-[0.5em] mb-2">
          ERROR
        </p>
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Are you lost?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          The page you're looking for hasn't been written yet.
        </p>
        <Button className="w-full" onClick={() => navigate('/')}>
          Back
        </Button>
      </div>
    </div>
  )
}
