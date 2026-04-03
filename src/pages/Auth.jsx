import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useFormState } from '../hooks/useFormState'
import { Button, Input, Card } from '../components/ui'
import Logo from '../components/ui/logo.webp'
import { DarkModeToggle } from '../components/ui/DarkModeToggle'

export default function Auth() {
  const location = useLocation()
  const { authState, signIn, signUp, signInAsGuest } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const { error, message, setSuccess, setFail, clear } = useFormState()

  const nextPath = new URLSearchParams(location.search).get('next') || '/dashboard'

  if (authState.user) {
    return <Navigate to={nextPath} replace />
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    clear()

    try {
      const isSignIn = mode === 'signin'
      const action = isSignIn ? signIn : signUp
      const result = isSignIn
        ? await action(email, password)
        : await action(email, password, displayName)

      if (!result.success) {
        setFail(result.error)
      } else if (!isSignIn) {
        setSuccess(result.message || 'Account created. Check your email for verification.')
        setMode('signin')
        setDisplayName('')
      }
    } catch (err) {
      setFail(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(prev => prev === 'signin' ? 'signup' : 'signin')
    clear()
    setDisplayName('')
  }

  const onGuestSignIn = async () => {
    if (loading) return
    setLoading(true)
    clear()

    try {
      const result = await signInAsGuest()
      if (!result.success) {
        setFail(result.error)
      }
    } catch (err) {
      setFail(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <img
              src={Logo}
              alt="Squill logo"
              draggable={false}
              className="h-10 w-10 rounded-md object-cover pointer-events-none select-none"
            />
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-gray-100 pointer-events-none select-none">Squill</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100 mb-2 tracking-tight">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>


          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-900/50 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded border border-green-200 dark:border-green-900/50 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
            />
            {mode === 'signup' && (
              <Input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your display name"
                required={mode === 'signup'}
                disabled={loading}
                className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
              />
            )}
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              disabled={loading}
              className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
            />
            <Button className="w-full bg-brand-600 text-white hover:bg-brand-700 font-medium" type="submit" disabled={loading || (mode === 'signup' && !displayName.trim())}>
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-gray-700" />
            <span className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-gray-700" />
          </div>

          <Button
            className="mt-4 w-full bg-gray-700 dark:bg-gray-700 text-gray-200 dark:text-gray-200 hover:bg-gray-600 dark:hover:bg-gray-600 font-medium border border-gray-600 dark:border-gray-600"
            type="button"
            onClick={onGuestSignIn}
            disabled={loading}
          >
            Continue as Guest
          </Button>
          <p className="mt-2 text-xs text-slate-500 dark:text-gray-500 text-center">
            No account needed — perfect for exploring the app
          </p>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-gray-700 text-sm text-slate-600 dark:text-gray-400">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={toggleMode}
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          <Link to="/auth/reset-password" className="mt-4 inline-block text-sm text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-300 transition-colors">
            Forgot password?
          </Link>
        </div>
      </Card>
      <DarkModeToggle className="fixed bottom-4 right-4 border border-slate-200 bg-white/80 text-slate-700 backdrop-blur-sm shadow-sm dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200" />
    </div>
  )
}
