import { Link } from 'react-router-dom'
import { Button, Card } from '../components/ui'

import { useEffect } from 'react'

export default function NotFound() {
  useEffect(() => {
    document.title = 'Page Not Found — Squill'
  }, [])
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-gray-800 border-gray-700 text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-white mb-2">Page Not Found</h2>
        <p className="text-gray-400 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/campaigns">
          <Button className="w-full">
            Go to Campaigns
          </Button>
        </Link>
      </Card>
    </div>
  )
}
