import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { requireSupabase, supabase } from '../lib/supabase'
import {
  validateSignIn,
  validateSignUp,
  validateResetPassword,
  ValidationError,
} from '../lib/validation'

interface AuthState {
  user: User | null
  session: Session | null
  displayName: string | null
  avatarUrl: string | null
  isLoading: boolean
  isConfigured: boolean
  isGuest: boolean
}

const GUEST_STORAGE_KEY = 'squill_guest_session'
const PROFILE_UPDATED_EVENT = 'squill:profile-updated'

interface ProfileUpdatedDetail {
  userId: string
  displayName: string | null
  avatarUrl: string | null
}

function createGuestUser(): User {
  const guestId = crypto.randomUUID()
  return {
    id: guestId,
    aud: 'authenticated',
    role: 'authenticated',
    email: `guest-${guestId.slice(0, 8)}@guest.local`,
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'guest', providers: ['guest'] },
    user_metadata: { display_name: 'Guest' },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as User
}

function loadGuestSession(): { user: User; displayName: string } | null {
  try {
    const stored = sessionStorage.getItem(GUEST_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.user && parsed.displayName) {
        return parsed
      }
    }
  } catch {
    // Ignore invalid stored data
  }
  return null
}

function saveGuestSession(user: User, displayName: string): void {
  sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ user, displayName }))
}

function clearGuestSession(): void {
  sessionStorage.removeItem(GUEST_STORAGE_KEY)
}

function useSupabaseAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    displayName: null,
    avatarUrl: null,
    isLoading: true,
    isConfigured: Boolean(supabase),
    isGuest: false,
  })

  const loadProfile = useCallback(async (userId: string): Promise<{ displayName: string | null; avatarUrl: string | null }> => {
    if (!supabase) return { displayName: null, avatarUrl: null }
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    if (error) return { displayName: null, avatarUrl: null }
    return {
      displayName: data?.display_name?.trim() || null,
      avatarUrl: data?.avatar_url || null
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      // Check for existing guest session when Supabase is not configured
      const guestSession = loadGuestSession()
      if (guestSession) {
        setAuthState({
          user: guestSession.user,
          session: null,
          displayName: guestSession.displayName,
          avatarUrl: null,
          isLoading: false,
          isConfigured: false,
          isGuest: true,
        })
      } else {
        setAuthState({ user: null, session: null, displayName: null, avatarUrl: null, isLoading: false, isConfigured: false, isGuest: false })
      }
      return
    }

    let mounted = true

    // Check for existing guest session first
    const guestSession = loadGuestSession()
    if (guestSession) {
      setAuthState({
        user: guestSession.user,
        session: null,
        displayName: guestSession.displayName,
        avatarUrl: null,
        isLoading: false,
        isConfigured: true,
        isGuest: true,
      })
      return
    }

    const applySession = (session: Session | null) => {
      setAuthState((current) => ({
        ...current,
        user: session?.user ?? null,
        session,
        displayName: session?.user ? current.displayName : null,
        avatarUrl: session?.user ? current.avatarUrl : null,
        isLoading: false,
        isConfigured: true,
        isGuest: false,
      }))

      if (session?.user) {
        loadProfile(session.user.id).then(({ displayName, avatarUrl }) => {
          if (!mounted) return
          setAuthState((current) => {
            if (current.user?.id !== session.user.id) return current
            return { ...current, displayName, avatarUrl }
          })
        })
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const session = data?.session ?? null
      applySession(session)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      applySession(session ?? null)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [loadProfile])

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<ProfileUpdatedDetail>
      const detail = customEvent.detail
      if (!detail?.userId) return

      setAuthState((current) => {
        if (current.user?.id !== detail.userId) return current
        return {
          ...current,
          displayName: detail.displayName,
          avatarUrl: detail.avatarUrl,
        }
      })
    }

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated as EventListener)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated as EventListener)
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: unknown; user?: User | null; session?: Session | null }> => {
    try {
      // Validate inputs before sending to Supabase
      const validated = validateSignIn({ email, password })
      const client = requireSupabase()
      const { data, error } = await client.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      })
      if (error) return { success: false, error }
      return { success: true, user: data.user, session: data.session }
    } catch (err) {
      if (err instanceof ValidationError) {
        return { success: false, error: err.getClientMessage() }
      }
      return { success: false, error: err }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName?: string): Promise<{ success: boolean; error?: unknown; user?: User | null; message?: string }> => {
    try {
      // Validate inputs before sending to Supabase
      const validated = validateSignUp({ email, password, displayName })
      const client = requireSupabase()
      const { data, error } = await client.auth.signUp({
        email: validated.email,
        password: validated.password,
      })
      if (error) return { success: false, error }
      
      // Create profile with display name if provided
      if (validated.displayName && data.user?.id) {
        try {
          await client.from('profiles').insert({
            id: data.user.id,
            display_name: validated.displayName, // Already trimmed by schema
          })
        } catch (profileError) {
          console.warn('Failed to create profile:', profileError)
          // Don't fail signup if profile creation fails
        }
      }
      
      const needsVerification = !data.session && !data.user?.email_confirmed_at
      return {
        success: true,
        user: data.user ?? null,
        message: needsVerification
          ? 'Account created. Check your email to verify before signing in.'
          : 'Account created successfully.',
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        return { success: false, error: err.getClientMessage() }
      }
      return { success: false, error: err }
    }
  }, [])

  const signInAsGuest = useCallback(async (): Promise<{ success: boolean; error?: unknown; user?: User | null }> => {
    try {
      const guestUser = createGuestUser()
      const displayName = 'Guest'
      
      saveGuestSession(guestUser, displayName)
      
      setAuthState({
        user: guestUser,
        session: null,
        displayName,
        avatarUrl: null,
        isLoading: false,
        isConfigured: Boolean(supabase),
        isGuest: true,
      })
      
      return { success: true, user: guestUser }
    } catch (err) {
      return { success: false, error: err }
    }
  }, [])

  const signOut = useCallback(async (): Promise<{ success: boolean; error?: unknown }> => {
    // Handle guest sign out
    if (authState.isGuest) {
      clearGuestSession()
      setAuthState({
        user: null,
        session: null,
        displayName: null,
        avatarUrl: null,
        isLoading: false,
        isConfigured: Boolean(supabase),
        isGuest: false,
      })
      return { success: true }
    }

    const client = requireSupabase()
    const { error } = await client.auth.signOut()
    if (error) return { success: false, error }
    return { success: true }
  }, [authState.isGuest])

  const resetPasswordForEmail = useCallback(async (email: string): Promise<{ success: boolean; error?: unknown; message?: string }> => {
    try {
      // Validate email before sending
      const validated = validateResetPassword({ email })
      const client = requireSupabase()
      const { error } = await client.auth.resetPasswordForEmail(validated.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) return { success: false, error }
      return { success: true, message: 'Password reset email sent.' }
    } catch (err) {
      if (err instanceof ValidationError) {
        return { success: false, error: err.getClientMessage() }
      }
      return { success: false, error: err }
    }
  }, [])

  const refreshSession = useCallback(async (): Promise<{ success: boolean; error?: unknown; session?: Session | null }> => {
    const client = requireSupabase()
    const { data, error } = await client.auth.refreshSession()
    if (error) return { success: false, error }
    setAuthState((current) => ({
      ...current,
      user: data.session?.user ?? null,
      session: data.session ?? null,
      displayName: data.session?.user ? current.displayName : null,
      avatarUrl: data.session?.user ? current.avatarUrl : null,
      isLoading: false,
    }))
    return { success: true, session: data.session ?? null }
  }, [])

  const refreshProfile = useCallback(async (): Promise<{ success: boolean; error?: unknown; displayName?: string | null; avatarUrl?: string | null }> => {
    if (!authState.user) return { success: false, error: 'No authenticated user' }
    const { displayName, avatarUrl } = await loadProfile(authState.user.id)
    setAuthState((current) => ({ ...current, displayName, avatarUrl }))
    window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, {
      detail: {
        userId: authState.user.id,
        displayName,
        avatarUrl,
      },
    }))
    return { success: true, displayName, avatarUrl }
  }, [authState.user, loadProfile])

  return useMemo(() => ({
    authState,
    signIn,
    signUp,
    signInAsGuest,
    signOut,
    resetPasswordForEmail,
    refreshSession,
    refreshProfile,
  }), [authState, refreshProfile, refreshSession, resetPasswordForEmail, signIn, signInAsGuest, signOut, signUp])
}

export const useAuth = useSupabaseAuth
