import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../hooks/useSupabaseAuth'
import { useFormState } from '../hooks/useFormState'
import { useDarkMode } from '../hooks/useDarkMode'
import { requireSupabase } from '../lib/supabase'
import { Button, Input } from '../components/ui'

export default function Settings() {
  const { authState, refreshProfile } = useAuth()
  const { theme, setTheme } = useDarkMode()
  
  // Public Profile State
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const fileInputRef = useRef(null)
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

  useEffect(() => {
    if (authState.user) {
      setDisplayName(authState.displayName || '')
      setAvatarUrl(authState.avatarUrl)
      setEmail(authState.user.email || '')
    }
  }, [authState.displayName, authState.avatarUrl, authState.user])

  const handleAvatarUpload = async (event) => {
    try {
      setUploading(true)
      profileForm.clear()
      
      if (!event.target.files || event.target.files.length === 0) {
        return
      }

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${authState.user.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const supabase = requireSupabase()
      
      // Upload to 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update local state and DB
      setAvatarUrl(publicUrl)
      
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: authState.user.id,
          avatar_url: publicUrl,
          display_name: displayName || authState.displayName
        })

      if (updateError) throw updateError

      await refreshProfile()
      profileForm.setSuccess('Avatar updated successfully')
    } catch (error) {
      profileForm.setFail(error.message === 'The resource was not found' 
        ? 'Storage bucket "avatars" not found. Please contact support.' 
        : 'Error uploading avatar: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!authState.user) return
    setProfileSaving(true)
    profileForm.clear()

    try {
      const trimmed = displayName.trim()
      if (!trimmed) {
        profileForm.setFail('Display Name is required')
        return
      }

      const { error: upsertError } = await requireSupabase()
        .from('profiles')
        .upsert({
          id: authState.user.id,
          display_name: trimmed,
          avatar_url: avatarUrl // Preserve current avatar
        })
      if (upsertError) throw upsertError

      await refreshProfile()
      profileForm.setSuccess('Profile updated successfully')
    } catch (saveError) {
      profileForm.setFail(saveError)
    } finally {
      setProfileSaving(false)
    }
  }

  const updateEmail = async (event) => {
    event.preventDefault()
    if (!email) return
    if (email === authState.user?.email) {
      accountForm.setFail('New email must be different from current email')
      return
    }
    
    setEmailLoading(true)
    accountForm.clear()

    try {
      const { error } = await requireSupabase().auth.updateUser({ email })
      if (error) throw error
      accountForm.setSuccess('Confirmation link sent to both old and new email addresses.')
    } catch (error) {
      accountForm.setFail(error)
    } finally {
      setEmailLoading(false)
    }
  }

  const updatePassword = async (event) => {
    event.preventDefault()
    if (!password) return
    if (password !== confirmPassword) {
      securityForm.setFail('Passwords do not match')
      return
    }
    if (password.length < 6) {
      securityForm.setFail('Password must be at least 6 characters')
      return
    }

    setSecurityLoading(true)
    securityForm.clear()

    try {
      const { error } = await requireSupabase().auth.updateUser({ password })
      if (error) throw error
      securityForm.setSuccess('Password updated successfully')
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      securityForm.setFail(error)
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
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative h-20 w-20 rounded-full overflow-hidden bg-slate-100 dark:bg-gray-700 border-2 border-slate-200 dark:border-gray-600 flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400 dark:text-gray-500 text-2xl font-bold">
                  {displayName ? displayName.charAt(0).toUpperCase() : '?'}
                </div>
              )}
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                className="hidden"
                accept="image/*"
                disabled={uploading}
              />
              <Button 
                type="button"
                className="bg-brand-600 text-white hover:bg-brand-700 dark:hover:bg-brand-700 shadow-sm text-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Change Picture'}
              </Button>
              <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">
                JPG, GIF or PNG. Max size of 2MB.
              </p>
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Display Name</label>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
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
                onChange={(event) => setEmail(event.target.value)}
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
                disabled={emailLoading || email === authState.user?.email}
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
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="New password"
                  disabled={securityLoading}
                  className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  disabled={securityLoading}
                  className="bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-700 text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>

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
