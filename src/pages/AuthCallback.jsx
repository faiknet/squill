import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useSupabaseAuth'
import { LoadingSpinner } from '../components/ui'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { authState } = useAuth()

  useEffect(() => {
    document.title = 'Completing sign in — Squill'
  }, [])

  useEffect(() => {
    if (!authState.isLoading) {
      if (authState.user) {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [authState.isLoading, authState.user, navigate])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-4 text-sm text-slate-600 dark:text-gray-400">
          Completing sign in...
        </p>
      </div>
    </div>
  )
}
