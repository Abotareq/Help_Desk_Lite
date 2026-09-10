import { createContext } from 'react'

/** What the person chose. 'system' means "keep following the OS". */
export type ThemePreference = 'light' | 'dark' | 'system'

/** What is actually on screen once 'system' has been resolved. */
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeContextValue {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

/**
 * Context and constants live apart from the provider component, the same way
 * authContext does. A module that exports both a component and a non-component
 * breaks React Fast Refresh — silently, and only visible in the dev server's
 * HMR log, which is how this project lost an afternoon once already.
 */
export const ThemeContext = createContext<ThemeContextValue | null>(null)

export const THEME_KEY = 'helpdesk.theme'

export const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system']

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as string[]).includes(value)
}
