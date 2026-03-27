import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useFormState } from '../hooks/useFormState'
import { requireSupabase } from '../lib/supabase'
import { Button, Card } from '../components/ui'

function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshSession, authState } = useAuth()
  const { user } = authState

  // Get email from location state or current user email
  const email = location.state?.email || user?.email

  const [resending, setResending] = useState(false)
  const { error, message, setSuccess, setFail, clear } = useFormState()

  useEffect(() => {
    // Refresh session and check verification status
    refreshSession().then(() => {
      // Check if email is now verified
      const isVerified = user?.email_confirmed_at !== null
      if (isVerified) {
        setSuccess('Your email has been verified!')
        // Clear location state after a short delay
        const timer = setTimeout(() => {
          navigate('/')
        }, 2000)
        return () => clearTimeout(timer)
      }
    })
  }, [user, refreshSession, navigate, setSuccess])

  const handleResend = async (e) => {
    e.preventDefault()
    setResending(true)
    clear()

    try {
      const { error } = await requireSupabase().auth.resend({
        type: 'signup',
        email,
      })
      if (error) throw error
      setSuccess('Verification email sent. Check your inbox.')
    } catch (err) {
      setFail(err)
    } finally {
      setResending(false)
    }
  }

  const handleBack = () => {
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="p-6">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100 mb-2 tracking-tight">Verify Your Email</h1>
            <p className="text-slate-600 dark:text-gray-400 text-sm">
              We've sent a verification email to{' '}
              <span className="text-slate-900 dark:text-gray-100 font-medium">{email}</span>
            </p>
          </div>

          {message && (
            <div className="mb-4 p-3 rounded border bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded border bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-slate-600 dark:text-gray-400 text-sm text-center">
              If you don't see the email, check your spam folder or request a new verification email below.
            </p>

            <Button
              onClick={handleResend}
              className="w-full bg-brand-600 text-white hover:bg-brand-700 font-medium"
              disabled={resending}
            >
              {resending ? 'Sending...' : 'Resend Verification Email'}
            </Button>

            <Button
              onClick={handleBack}
              variant="outline"
              className="w-full border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
            >
              Back
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-gray-700 text-center">
            <p className="text-xs text-slate-500 dark:text-gray-500">
              Didn't receive the email?{' '}
              <button
                onClick={handleResend}
                className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
              >
                Click here to resend
              </button>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default VerifyEmail
