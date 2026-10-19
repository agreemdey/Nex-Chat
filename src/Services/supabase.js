import { createClient } from '@supabase/supabase-js'

const REMEMBER_ME_KEY = 'nexchat:remember-me'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const fallbackStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

const getStorageForPreference = (rememberMe) => {
  if (typeof window === 'undefined') return fallbackStorage
  return rememberMe ? window.localStorage : window.sessionStorage
}

const getRememberPreference = () => {
  if (typeof window === 'undefined') return true

  const savedPreference = window.localStorage.getItem(REMEMBER_ME_KEY)
  return savedPreference === null ? true : savedPreference !== 'false'
}

let currentStorage = getStorageForPreference(getRememberPreference())

export const setSupabaseStoragePreference = (rememberMe) => {
  if (typeof window === 'undefined') return

  const nextStorage = getStorageForPreference(Boolean(rememberMe))
  const previousStorage = getStorageForPreference(!Boolean(rememberMe))
  window.localStorage.setItem(REMEMBER_ME_KEY, String(Boolean(rememberMe)))

  if (previousStorage !== nextStorage) {
    const persistedKeys = []
    for (let index = 0; index < previousStorage.length; index += 1) {
      const key = previousStorage.key(index)
      if (key && key.startsWith('sb-') && /auth|session/i.test(key)) {
        persistedKeys.push(key)
      }
    }

    persistedKeys.forEach((key) => {
      const value = previousStorage.getItem(key)
      if (value !== null) {
        nextStorage.setItem(key, value)
      }
      previousStorage.removeItem(key)
    })
  }

  currentStorage = nextStorage
}

const storageAdapter = {
  getItem: (key) => currentStorage.getItem(key),
  setItem: (key, value) => currentStorage.setItem(key, value),
  removeItem: (key) => currentStorage.removeItem(key),
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: storageAdapter,
    },
  }
)

export { REMEMBER_ME_KEY, getRememberPreference }
