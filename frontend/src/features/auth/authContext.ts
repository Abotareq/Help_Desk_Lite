import { createContext } from 'react'
import type { User } from '../../types/domain'

export interface AuthContextValue {
  user: User | null
  /** True only while a stored token is being verified on first load. */
  initialising: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

/**
 * Split from the provider component so the module exports only a value, not a
 * mix of a component and a constant — which is what keeps Fast Refresh working.
 */
export const AuthContext = createContext<AuthContextValue | null>(null)
