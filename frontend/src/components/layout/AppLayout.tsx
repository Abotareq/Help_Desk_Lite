import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth, useCurrentUser } from '../../hooks/useAuth'
import { Sidebar } from './Sidebar'

const COLLAPSE_KEY = 'helpdesk.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppLayout() {
  const user = useCurrentUser()
  const { signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(readCollapsed)

  function toggle() {
    setCollapsed((previous) => {
      const next = !previous
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next))
      } catch {
        /* A forgotten preference is not worth failing over. */
      }
      return next
    })
  }

  return (
    <div className="flex h-full">
      <Sidebar user={user} onSignOut={signOut} collapsed={collapsed} onToggle={toggle} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface">
        <Outlet />
      </main>
    </div>
  )
}
