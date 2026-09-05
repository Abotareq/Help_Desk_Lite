import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchMe, login as loginRequest } from '../../api/auth'
import { setUnauthorizedHandler, tokenStore } from '../../api/client'
import type { User } from '../../types/domain'
import { AuthContext, type AuthContextValue } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // Derived from whether there is anything to verify, rather than set inside an
  // effect: with no stored token there is no loading state to be in.
  const [initialising, setInitialising] = useState(() => Boolean(tokenStore.get()))
  const queryClient = useQueryClient()

  const signOut = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    // Otherwise the next person to sign in briefly sees the last one's data.
    queryClient.clear()
  }, [queryClient])

  // A rejected token should drop us to sign-in wherever it happens, not only on
  // the call that noticed.
  useEffect(() => {
    setUnauthorizedHandler(signOut)
  }, [signOut])

  // A stored token survives a refresh, but it may have expired since — so it is
  // verified against the API rather than trusted.
  useEffect(() => {
    if (!tokenStore.get()) return

    let cancelled = false
    fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        if (!cancelled) tokenStore.clear()
      })
      .finally(() => {
        if (!cancelled) setInitialising(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await loginRequest({ email, password })
    tokenStore.set(result.token)
    setUser(result.user)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, initialising, signIn, signOut }),
    [user, initialising, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
