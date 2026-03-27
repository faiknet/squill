import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { requireSupabase, supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  displayName: string | null
  avatarUrl: string | null
  isLoading: boolean
  isConfigured: boolean
}

export function useSupabaseAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    displayName: null,
    avatarUrl: null,
    isLoading: true,
    isConfigured: Boolean(supabase),
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
      setAuthState({ user: null, session: null, displayName: null, avatarUrl: null, isLoading: false, isConfigured: false })
      return
    }

    let mounted = true

    const applySession = (session: Session | null) => {
      setAuthState((current) => ({
        ...current,
        user: session?.user ?? null,
        session,
        displayName: session?.user ? current.displayName : null,
        avatarUrl: session?.user ? current.avatarUrl : null,
        isLoading: false,
        isConfigured: true,
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

  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: unknown; user?: User | null; session?: Session | null }> => {
    const client = requireSupabase()
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error }
    return { success: true, user: data.user, session: data.session }
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName?: string): Promise<{ success: boolean; error?: unknown; user?: User | null; message?: string }> => {
    const client = requireSupabase()
    const { data, error } = await client.auth.signUp({ email, password })
    if (error) return { success: false, error }
    
    // Create profile with display name if provided
    if (displayName && data.user?.id) {
      try {
        await client.from('profiles').insert({
          id: data.user.id,
          display_name: displayName.trim()
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
  }, [])

  const signOut = useCallback(async (): Promise<{ success: boolean; error?: unknown }> => {
    const client = requireSupabase()
    const { error } = await client.auth.signOut()
    if (error) return { success: false, error }
    return { success: true }
  }, [])

  const resetPasswordForEmail = useCallback(async (email: string): Promise<{ success: boolean; error?: unknown; message?: string }> => {
    const client = requireSupabase()
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) return { success: false, error }
    return { success: true, message: 'Password reset email sent.' }
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
    return { success: true, displayName, avatarUrl }
  }, [authState.user, loadProfile])

  return useMemo(() => ({
    authState,
    signIn,
    signUp,
    signOut,
    resetPasswordForEmail,
    refreshSession,
    refreshProfile,
  }), [authState, refreshProfile, refreshSession, resetPasswordForEmail, signIn, signOut, signUp])
}

export const useAuth = useSupabaseAuth
