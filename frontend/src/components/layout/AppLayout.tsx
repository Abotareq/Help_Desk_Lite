import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth, useCurrentUser } from '../../hooks/useAuth'
import { SidebarContext } from './sidebarContext'
import { Sidebar } from './Sidebar'

const OPEN_KEY = 'helpdesk.sidebarOpen'

const DOCKED_FROM = 768

/**
 * Docked and open on a desktop; always closed on a phone.
 *
 * The stored preference is deliberately ignored below the breakpoint: there it
 * covers the whole page, so opening on load would hide the screen the user
 * asked for. A preference set at a desk should not follow them onto a phone.
 */
function readInitialOpen(): boolean {
  if (typeof window === 'undefined') return true
  if (window.innerWidth < DOCKED_FROM) return false

  try {
    const stored = localStorage.getItem(OPEN_KEY)
    if (stored !== null) return stored === 'true'
  } catch {
    /* A forgotten preference is not worth failing over. */
  }
  return true
}

export function AppLayout() {
  const user = useCurrentUser()
  const { signOut } = useAuth()
  const [open, setOpen] = useState(readInitialOpen)

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, String(open))
    } catch {
      /* Ignore. */
    }
  }, [open])

  // Escape closes it, which matters most on a phone where it covers the page.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <SidebarContext.Provider value={{ open, toggle: () => setOpen((v) => !v) }}>
      <div className="flex h-full overflow-hidden">
        <Sidebar user={user} onSignOut={signOut} open={open} onClose={() => setOpen(false)} />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface">
          <Outlet />
        </main>
      </div>
    </SidebarContext.Provider>
  )
}
