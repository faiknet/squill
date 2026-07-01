import { useState, useEffect } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useFormState } from '../hooks/useFormState'
import { Button, Input, Card } from '../components/ui'
import Logo from '../components/ui/logo.webp'
import { DarkModeToggle } from '../components/ui/DarkModeToggle'

export default function Auth() {
  const location = useLocation()
  const { authState, signIn, signUp, signInWithGoogle, signInAsGuest } = useAuth()
  const [mode, setMode] = useState('signup')

  useEffect(() => {
    document.title = mode === 'signin' ? 'Sign In — Squill' : 'Create Account — Squill'
  }, [mode])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)
  const { error, message, setSuccess, setFail, clear } = useFormState()

  const nextPath = new URLSearchParams(location.search).get('next') || '/dashboard'
  const passwordDoesNotMeetRequirements =
    mode === 'signup' &&
    password.length > 0 &&
    (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password))

  if (authState.user) {
    return <Navigate to={nextPath} replace />
  }

  const validateEmail = (value) => {
    if (!value.trim()) return 'Please enter your email address.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.'
    return ''
  }

  const validatePassword = (value) => {
    if (!value) return 'Please enter your password.'
    return ''
  }

  const getFieldError = (err) => {
    if (!err) return {}
    const msg = err instanceof Error ? err.message : err?.message || String(err)
    const lower = msg.toLowerCase()
    if (lower.includes('invalid login credentials') || lower.includes('wrong password') || lower.includes('email or password') || lower.includes('incorrect')) {
      return { password: 'Password does not match the email address.' }
    }
    if (lower.includes('email not confirmed') || lower.includes('email not verified')) {
      return { email: 'Please verify your email before signing in.' }
    }
    return {}
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    const isSignIn = mode === 'signin'
    if (isSignIn) {
      const eErr = validateEmail(email)
      const pErr = validatePassword(password)
      setEmailError(eErr)
      setPasswordError(pErr)
      if (eErr || pErr) return
    }

    setLoading(true)
    clear()

    try {
      const action = isSignIn ? signIn : signUp
      const result = await action(email, password)

      if (!result.success) {
        if (isSignIn) {
          const fieldErr = getFieldError(result.error)
          if (fieldErr.password) {
            setPasswordError(fieldErr.password)
          }
          if (fieldErr.email) {
            setEmailError(fieldErr.email)
          }
          if (!fieldErr.password && !fieldErr.email) {
            setFail(result.error)
          }
        } else {
          setFail(result.error)
        }
      } else if (!isSignIn) {
        setSuccess(result.message || 'Account created. Check your email for verification.')
        setMode('signin')
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
    setEmailError('')
    setPasswordError('')
  }

  const onGoogleSignIn = async () => {
    if (loading) return
    setLoading(true)
    clear()

    const result = await signInWithGoogle()
    if (!result.success) {
      setFail(result.error)
      setLoading(false)
    }
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
      <Card className="max-w-md w-full bg-white dark:bg-gray-800 border-0 shadow-sm">
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
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-900/50 text-sm" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded border border-green-200 dark:border-green-900/50 text-sm" role="status">
              {message}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="sr-only">Email address</label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); if (emailError) setEmailError('') }}
                placeholder="you@example.com"
                required
                disabled={loading}
                aria-invalid={!!emailError || undefined}
                className={`bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500 ${emailError ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 dark:border-gray-700'}`}
              />
              {emailError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{emailError}</p>
              )}
            </div>
            <div>
              <label htmlFor="auth-password" className="sr-only">Password</label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); if (passwordError) setPasswordError('') }}
                placeholder="Password"
                required
                disabled={loading}
                aria-invalid={passwordDoesNotMeetRequirements || !!passwordError || undefined}
                aria-describedby={(passwordDoesNotMeetRequirements ? 'password-error' : passwordError ? 'password-error-signin' : undefined)}
                className={`bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500 ${passwordDoesNotMeetRequirements || passwordError ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-200 dark:border-gray-700'}`}
              />
              {passwordDoesNotMeetRequirements && (
                <p id="password-error" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  Password does not meet requirements.
                </p>
              )}
              {passwordError && (
                <p id="password-error-signin" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{passwordError}</p>
              )}
              {mode === 'signup' && !passwordDoesNotMeetRequirements && (
                <p className="mt-1 text-xs text-slate-500/80 dark:text-gray-400/80">
                  Password should be at least 8 characters including a number and an upper case letter.
                </p>
              )}
            </div>
            <Button className="w-full bg-brand-600 text-white hover:bg-brand-700 font-medium" type="submit" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>

          <Button
            variant="outline"
            className="mt-4 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium border border-gray-300 dark:border-gray-600"
            type="button"
            onClick={onGoogleSignIn}
            disabled={loading}
          >
            <svg className="w-5 h-5 mr-2 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Redirecting...' : 'Sign in with Google'}
          </Button>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-gray-700" />
            <span className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-gray-700" />
          </div>

          <Button
            className="mt-2 w-full bg-gray-700 dark:bg-gray-700 text-gray-200 dark:text-gray-200 hover:bg-gray-600 dark:hover:bg-gray-600 font-medium border border-gray-600 dark:border-gray-600"
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
