import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useSupabaseAuth'
import { requireSupabase } from '../lib/supabase'
import { useFormState } from '../hooks/useFormState'
import { Button, Input, Card } from '../components/ui'

function AuthResetPassword() {
  const navigate = useNavigate()
  const { authState, resetPasswordForEmail } = useAuth()

  useEffect(() => {
    document.title = 'Reset Password — Squill'
  }, [])

  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const { error, message, setSuccess, setFail, clear } = useFormState()

  const [sent, setSent] = useState(false)

  const isRecovery = !authState.isLoading && authState.user !== null

  const handleSendLink = async (e) => {
    e.preventDefault()
    setLoading(true)
    clear()

    try {
      const result = await resetPasswordForEmail(email)
      if (result.success) {
        setSent(true)
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

  const handleResetPassword = async (e) => {
    e.preventDefault()
    clear()

    if (newPassword !== confirmPassword) {
      setFail('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error } = await requireSupabase().auth.updateUser({ password: newPassword })
      if (error) throw error
      setSuccess('Password updated successfully. Redirecting to sign in...')
      setTimeout(() => navigate('/?mode=signin'), 3000)
    } catch (err) {
      setFail(err?.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    navigate(-1)
  }

  if (isRecovery) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100 mb-2 tracking-tight">Set New Password</h1>
              <p className="text-slate-600 dark:text-gray-400 text-sm">
                Enter your new password below.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-900/50 text-sm">{error}</div>
            )}
            {message && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded border border-green-200 dark:border-green-900/50 text-sm">{message}</div>
            )}

            {!message && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    New Password
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                    className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                    className="bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <Button type="submit" className="w-full bg-brand-600 text-white hover:bg-brand-700 font-medium" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            )}

            {message && (
              <div className="mt-6 text-center">
                <Button onClick={() => navigate('/?mode=signin')} variant="outline" className="border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700">
                  Go to Sign In
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100 mb-2 tracking-tight">Reset Password</h1>
            <p className="text-slate-600 dark:text-gray-400 text-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-900/50 text-sm">{error}</div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded border border-green-200 dark:border-green-900/50 text-sm">{message}</div>
          )}

          {!sent && (
            <form onSubmit={handleSendLink} className="space-y-4">
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
          )}

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
