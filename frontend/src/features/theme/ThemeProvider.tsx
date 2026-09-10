import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  THEME_KEY,
  ThemeContext,
  isThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from './themeContext'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Nobody has chosen yet, so follow the machine. A tool that opens blazing white
 * on someone whose desktop is dark has already got the first impression wrong,
 * and 'system' keeps following them if they change their mind at the OS level.
 */
function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (isThemePreference(stored)) return stored
  } catch {
    /* Private browsing, blocked storage — a forgotten preference is not fatal. */
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(DARK_QUERY).matches)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark)

  // Only meaningful while the preference is 'system', but the listener is cheap
  // and unsubscribing on every preference change would just add a code path.
  useEffect(() => {
    const media = window.matchMedia?.(DARK_QUERY)
    if (!media) return

    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference

  // On the documentElement rather than a wrapper div: the sign-in page renders
  // outside the app layout, and the body's own background is painted from these
  // same tokens.
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* The choice still applies for this session. */
    }
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
