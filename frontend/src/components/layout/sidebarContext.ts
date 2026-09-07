import { createContext, useContext } from 'react'

interface SidebarContextValue {
  open: boolean
  toggle: () => void
}

/**
 * Lets the page header offer the button that reopens a closed sidebar. Without
 * this the only control lives inside the sidebar, so closing it would strand
 * the user with no way back.
 */
export const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar(): SidebarContextValue | null {
  return useContext(SidebarContext)
}
