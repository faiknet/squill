import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useFormState } from '../hooks/useFormState'
import { useDarkMode } from '../hooks/useDarkMode'
import { requireSupabase } from '../lib/supabase'
import { Button, Input } from '../components/ui'
import {
  validateUpdateProfile,
  validateEmail,
  validatePassword,
  ValidationError,
} from '../lib/validation'

export default function Settings() {
  const { authState, refreshProfile } = useAuth()
  const { theme, setTheme } = useDarkMode()
  const isGuest = authState.isGuest

  // Public Profile State
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const profileForm = useFormState()

  // Account State
  const [email, setEmail] = useState('')
  const accountForm = useFormState()
  const [emailLoading, setEmailLoading] = useState(false)

  // Security State
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const securityForm = useFormState()
  const [securityLoading, setSecurityLoading] = useState(false)
  const passwordDoesNotMeetRequirements =
    password.length > 0 &&
    (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password))

  useEffect(() => {
    if (authState.user) {
      setDisplayName(authState.displayName || '')
      setAvatarUrl(authState.avatarUrl)
      setEmail(authState.user.email || '')
    }
  }, [authState.displayName, authState.avatarUrl, authState.user])

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!authState.user) return
    if (isGuest) {
      profileForm.setFail('Unavailable in Guest Mode')
      return
    }
    setProfileSaving(true)
    profileForm.clear()

    try {
      // Validate profile update
      const validated = validateUpdateProfile({
        displayName: displayName,
        avatarUrl: avatarUrl
      })

      const { error: upsertError } = await requireSupabase()
        .from('profiles')
        .upsert({
          id: authState.user.id,
          display_name: validated.displayName,
          avatar_url: validated.avatarUrl // Preserve current avatar
        })
      if (upsertError) throw upsertError

      await refreshProfile()
      profileForm.setSuccess('Profile updated successfully')
    } catch (saveError) {
      if (saveError instanceof ValidationError) {
        profileForm.setFail(saveError.getClientMessage())
      } else {
        profileForm.setFail(saveError?.message || 'Failed to save profile')
      }
    } finally {
      setProfileSaving(false)
    }
  }

  const updateEmail = async (event) => {
    event.preventDefault()
    if (isGuest) {
      accountForm.setFail('Unavailable in Guest Mode')
      return
    }
    if (!email) return
    if (email === authState.user?.email) {
      accountForm.setFail('New email must be different from current email')
      return
    }

    setEmailLoading(true)
    accountForm.clear()

    try {
      // Validate email format
      const validatedEmail = validateEmail(email)

      const { error } = await requireSupabase().auth.updateUser({ email: validatedEmail })
      if (error) throw error
      accountForm.setSuccess('Confirmation link sent to both old and new email addresses.')
    } catch (error) {
      if (error instanceof ValidationError) {
        accountForm.setFail(error.getClientMessage())
      } else {
        accountForm.setFail(error?.message || 'Failed to update email')
      }
    } finally {
      setEmailLoading(false)
    }
  }

  const updatePassword = async (event) => {
    event.preventDefault()
    if (isGuest) {
      securityForm.setFail('Unavailable in Guest Mode')
      return
    }
    if (!password) return
    if (password !== confirmPassword) {
      securityForm.setFail('Passwords do not match')
      return
    }

    setSecurityLoading(true)
    securityForm.clear()

    try {
      // Validate password strength
      const validatedPassword = validatePassword(password)

      const { error } = await requireSupabase().auth.updateUser({ password: validatedPassword })
      if (error) throw error
      securityForm.setSuccess('Password updated successfully')
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      if (error instanceof ValidationError) {
        securityForm.setFail(error.getClientMessage())
      } else {
        securityForm.setFail(error)
      }
    } finally {
      setSecurityLoading(false)
    }
  }

  if (authState.isLoading) {
    return <div className="text-slate-400 dark:text-gray-400 p-8 text-center">Loading settings...</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-gray-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Manage your account settings and preferences.</p>
      </div>

      {/* Public Profile Section */}
      <section className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">Public Profile</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">This information will be displayed to other users.</p>
        </div>

        <div className="p-6 space-y-6">


          <form onSubmit={saveProfile} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Display Name</label>
              <Input
                value={displayName}
                onChange={(event) => {
                  if (isGuest) {
                    profileForm.setFail('Unavailable in Guest Mode')
                    return
                  }
                  setDisplayName(event.target.value)
                }}
                placeholder="Enter your display name"
                disabled={profileSaving}
                className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            {profileForm.error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 text-sm">
                {profileForm.error}
              </div>
            )}

            {profileForm.message && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-md border border-green-200 dark:border-green-900/50 text-sm">
                {profileForm.message}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={profileSaving}
                className="bg-brand-600 text-white hover:bg-brand-700 dark:hover:bg-brand-700 shadow-sm"
              >
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Account Section */}
      <section className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">Account Settings</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Manage your email address.</p>
        </div>

        <div className="p-6">
          <form onSubmit={updateEmail} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => {
                  if (isGuest) {
                    accountForm.setFail('Unavailable in Guest Mode')
                    return
                  }
                  setEmail(event.target.value)
                }}
                placeholder="you@example.com"
                disabled={emailLoading}
                className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            {accountForm.error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 text-sm">
                {accountForm.error}
              </div>
            )}

            {accountForm.message && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-md border border-green-200 dark:border-green-900/50 text-sm">
                {accountForm.message}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={emailLoading || (!isGuest && email === authState.user?.email)}
                className="bg-brand-600 text-white hover:bg-brand-700 dark:hover:bg-brand-700 shadow-sm"
              >
                {emailLoading ? 'Updating...' : 'Update Email'}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Security Section */}
      <section className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">Security</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Update your password.</p>
        </div>

        <div className="p-6">
          <form onSubmit={updatePassword} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">New Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    if (isGuest) {
                      securityForm.setFail('Unavailable in Guest Mode')
                      return
                    }
                    setPassword(event.target.value)
                  }}
                  placeholder="New password"
                  disabled={securityLoading}
                  className={`bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500 ${passwordDoesNotMeetRequirements ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                />
                {passwordDoesNotMeetRequirements && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    Password does not meet requirements.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => {
                    if (isGuest) {
                      securityForm.setFail('Unavailable in Guest Mode')
                      return
                    }
                    setConfirmPassword(event.target.value)
                  }}
                  placeholder="Confirm new password"
                  disabled={securityLoading}
                  className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500/80 dark:text-gray-400/80">
              Password should be at least 8 characters including a number and an upper case letter.
            </p>

            {securityForm.error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-900/50 text-sm">
                {securityForm.error}
              </div>
            )}

            {securityForm.message && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-md border border-green-200 dark:border-green-900/50 text-sm">
                {securityForm.message}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={securityLoading || !password}
                className="bg-brand-600 text-white hover:bg-brand-700 dark:hover:bg-brand-700 shadow-sm"
              >
                {securityLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Appearance Section */}
      <section className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100">Appearance</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Choose how you'd like the interface to appear.</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <label className="flex items-center p-3 rounded-md border border-slate-200 dark:border-gray-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
              <input
                type="radio"
                name="theme"
                value="system"
                checked={theme === 'system'}
                onChange={(e) => setTheme(e.target.value)}
                className="w-4 h-4 cursor-pointer accent-blue-600"
              />
              <span className="ml-3 text-sm font-medium text-slate-900 dark:text-gray-100">
                System Default
              </span>
              <span className="ml-2 text-xs text-slate-500 dark:text-gray-400">
                (matches your system settings)
              </span>
            </label>

            <label className="flex items-center p-3 rounded-md border border-slate-200 dark:border-gray-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
              <input
                type="radio"
                name="theme"
                value="light"
                checked={theme === 'light'}
                onChange={(e) => setTheme(e.target.value)}
                className="w-4 h-4 cursor-pointer accent-blue-600"
              />
              <span className="ml-3 text-sm font-medium text-slate-900 dark:text-gray-100">
                Light Mode
              </span>
            </label>

            <label className="flex items-center p-3 rounded-md border border-slate-200 dark:border-gray-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={theme === 'dark'}
                onChange={(e) => setTheme(e.target.value)}
                className="w-4 h-4 cursor-pointer accent-blue-600"
              />
              <span className="ml-3 text-sm font-medium text-slate-900 dark:text-gray-100">
                Dark Mode
              </span>
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}
