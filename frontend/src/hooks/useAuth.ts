import { useContext } from 'react'
import { AuthContext } from '../features/auth/authContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}

/** The signed-in user, for screens that only render behind a ProtectedRoute. */
export function useCurrentUser() {
  const { user } = useAuth()
  if (!user) throw new Error('useCurrentUser used outside an authenticated route')
  return user
}
