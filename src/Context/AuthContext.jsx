/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  getRememberPreference,
  isSupabaseConfigured,
  setSupabaseStoragePreference,
  supabase,
} from '../Services/supabase'
import { createUserProfile } from '../Services/api'

const AuthContext = createContext(null)

const setRememberPreference = (rememberMe) => {
  setSupabaseStoragePreference(Boolean(rememberMe))
}

const mapUser = (supabaseUser) => {
  if (!supabaseUser) return null

  const metadata = supabaseUser.user_metadata ?? {}
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    username: metadata.username ?? supabaseUser.email?.split('@')[0] ?? 'user',
    name: metadata.full_name ?? metadata.name ?? 'NexChat user',
    avatarUrl: metadata.avatar_url ?? null,
    avatar: metadata.avatar_url ?? (metadata.full_name ?? 'U').slice(0, 1).toUpperCase(),
    bio: metadata.bio ?? metadata.status ?? 'Available for a quick chat',
    status: metadata.status ?? metadata.bio ?? 'Available for a quick chat',
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const applySession = useCallback((nextSession) => {
    setSession(nextSession)
    setUser(mapUser(nextSession?.user))
  }, [])

  const checkSession = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase authentication is not configured.')
      setLoading(false)
      return
    }

    setSupabaseStoragePreference(getRememberPreference())

    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) setError('Unable to restore your session.')
    applySession(data.session)
    setLoading(false)
  }, [applySession])

  useEffect(() => {
    const timer = window.setTimeout(checkSession, 0)
    if (!isSupabaseConfigured) return () => window.clearTimeout(timer)

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession)
      setLoading(false)
    })

    return () => {
      window.clearTimeout(timer)
      data.subscription.unsubscribe()
    }
  }, [applySession, checkSession])

  const login = useCallback(async (emailOrUsername, password, rememberMe = getRememberPreference()) => {
    setError(null)
    if (!isSupabaseConfigured) {
      const message = 'Supabase authentication is not configured.'
      setError(message)
      throw new Error(message)
    }

    setRememberPreference(rememberMe)
    const email = emailOrUsername.trim().toLowerCase()

    if (!email.includes('@')) {
      const message = 'Please log in with your email address.'
      setError(message)
      throw new Error(message)
    }

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError) {
      setError(loginError.message)
      throw new Error(loginError.message)
    }

    applySession(data.session)
    return mapUser(data.user)
  }, [applySession])

  const register = useCallback(async (name, username, email, password, rememberMe = getRememberPreference()) => {
    setError(null)
    if (!isSupabaseConfigured) {
      const message = 'Supabase authentication is not configured.'
      setError(message)
      throw new Error(message)
    }

    setRememberPreference(rememberMe)
    const { data, error: registerError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: name.trim(),
          username: username.trim().toLowerCase(),
          bio: 'Available for a quick chat',
          status: 'Available for a quick chat',
        },
      },
    })

    if (registerError) {
      setError(registerError.message)
      throw new Error(registerError.message)
    }

    applySession(data.session)
    if (!data.session?.access_token || !data.user) {
      const message = 'Account created. Confirm your email before entering NexChat.'
      setError(message)
      return null
    }

    try {
      await createUserProfile({
        username: username.trim().toLowerCase(),
        full_name: name.trim(),
        email: email.trim().toLowerCase(),
        bio: 'Available for a quick chat',
      }, data.session.access_token)
    } catch (profileError) {
      setError(`Account created, but your profile could not be saved: ${profileError.message}`)
      throw profileError
    }

    return mapUser(data.user)
  }, [applySession])

  const resendConfirmation = useCallback(async (email) => {
    setError(null)
    if (!isSupabaseConfigured) {
      const message = 'Supabase authentication is not configured.'
      setError(message)
      throw new Error(message)
    }

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (resendError) {
      setError(resendError.message)
      throw new Error(resendError.message)
    }
  }, [])

  const logout = useCallback(async () => {
    if (typeof window !== 'undefined') {
      setSupabaseStoragePreference(false)
      window.localStorage.removeItem('nexchat:remember-me')
    }

    if (!isSupabaseConfigured) {
      applySession(null)
      return
    }

    const { error: logoutError } = await supabase.auth.signOut()
    if (logoutError) setError(logoutError.message)
    applySession(null)
  }, [applySession])

  const resetPassword = useCallback(async (email) => {
    setError(null)
    if (!isSupabaseConfigured) throw new Error('Supabase authentication is not configured.')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
      throw new Error(resetError.message)
    }
  }, [])

  const loginWithGoogle = useCallback(async () => {
    setError(null)
    if (!isSupabaseConfigured) throw new Error('Supabase authentication is not configured.')

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })

    if (oauthError) {
      setError(oauthError.message)
      throw new Error(oauthError.message)
    }
  }, [])

  const updatePassword = useCallback(async (password) => {
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      throw new Error(updateError.message)
    }
  }, [])

  const updateProfile = useCallback(async (profile) => {
    setError(null)
    const nextFullName = profile.full_name.trim()
    const nextUsername = profile.username.trim().toLowerCase()
    const nextBio = profile.bio?.trim() || 'Available for a quick chat'
    const nextAvatarUrl = profile.avatar_url || null

    const { data, error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: nextFullName,
        username: nextUsername,
        avatar_url: nextAvatarUrl,
        bio: nextBio,
        status: nextBio,
      },
    })

    if (updateError) {
      setError(updateError.message)
      throw new Error(updateError.message)
    }

    const { data: freshUserData, error: freshUserError } = await supabase.auth.getUser()
    const refreshedUser = mapUser(freshUserData?.user ?? data.user)

    if (!freshUserError && refreshedUser) {
      setUser(refreshedUser)
    } else {
      setUser(mapUser({
        ...data.user,
        user_metadata: {
          ...(data.user?.user_metadata ?? {}),
          full_name: nextFullName,
          username: nextUsername,
          avatar_url: nextAvatarUrl,
          bio: nextBio,
          status: nextBio,
        },
      }))
    }

    await createUserProfile({
      username: nextUsername,
      full_name: nextFullName,
      email: data.user.email,
      avatar_url: nextAvatarUrl,
      bio: nextBio,
    }, session?.access_token)
  }, [session?.access_token])

  const value = useMemo(() => ({
    user,
    session,
    accessToken: session?.access_token ?? null,
    loading,
    error,
    isAuthenticated: Boolean(session?.user),
    login,
    register,
    resendConfirmation,
    resetPassword,
    loginWithGoogle,
    updatePassword,
    updateProfile,
    logout,
    checkSession,
  }), [user, session, loading, error, login, register, resendConfirmation, resetPassword, loginWithGoogle, updatePassword, updateProfile, logout, checkSession])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}