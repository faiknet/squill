import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useFormState } from '../hooks/useFormState'
import { Button, Input, Card } from '../components/ui'

function AuthResetPassword() {
  const navigate = useNavigate()
  const { resetPasswordForEmail } = useAuth()

  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const { error, message, setSuccess, setFail, clear } = useFormState()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    clear()

    try {
      const result = await resetPasswordForEmail(email)

      if (result.success) {
        setSuccess(result.message || 'Password reset email sent!')
        setEmail('')
      } else {
        setFail(result.error || 'Failed to send reset email')
      }
    } catch (err) {
      setFail(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    navigate(-1)
  }

  if (message || error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
          <div className="p-6 text-center">
            {message && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded border border-green-200 dark:border-green-900/50">
                <svg
                  className="w-12 h-12 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="font-medium">{message}</p>
              </div>
            )}
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-900/50">
                <svg
                  className="w-12 h-12 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="font-medium">{error}</p>
              </div>
            )}
            <p className="text-slate-600 dark:text-gray-400 mb-6 text-sm">
              We've sent a password reset link to your email address if it exists in our system.
            </p>
            <Button onClick={handleBack} variant="outline" className="w-full border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
              Back
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="p-6">
          <div className="mb-6 ">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100 mb-2 tracking-tight">Reset Password</h1>
            <p className="text-slate-600 dark:text-gray-400 text-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <Button type="submit" className="w-full bg-brand-600 text-white hover:bg-brand-700 font-medium" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-gray-700 text-center">
            <button
              onClick={handleBack}
              className="text-sm text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-300 transition-colors"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default AuthResetPassword
