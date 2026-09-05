import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types/domain'

interface ProtectedRouteProps {
  children: ReactNode
  /** When set, the route also requires one of these roles. */
  roles?: UserRole[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, initialising } = useAuth()
  const location = useLocation()

  // Without this the stored-token check would flash the sign-in page on every
  // refresh before resolving.
  if (initialising) {
    return (
      <div className="flex h-full items-center justify-center text-ink-subtle">
        <Spinner size={20} />
      </div>
    )
  }

  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />

  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />

  return <>{children}</>
}
