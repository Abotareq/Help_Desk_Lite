import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from '../../components/layout/ThemeToggle'
import { useTheme } from '../../hooks/useTheme'
import { I18nProvider } from '../../i18n/I18nProvider'
import { ThemeProvider } from './ThemeProvider'
import { THEME_KEY } from './themeContext'

/** Lets a test say what the operating system is asking for. */
function setSystemDark(dark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: dark,
    media: query,
    onchange: null,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  return {
    /** Simulate the OS switching under a running app. */
    change(nowDark: boolean) {
      act(() => {
        listeners.forEach((fn) => fn({ matches: nowDark } as MediaQueryListEvent))
      })
    },
  }
}

function Probe() {
  const { preference, resolved } = useTheme()
  return <p>{`${preference}/${resolved}`}</p>
}

function renderTheme() {
  // ThemeToggle reads its labels from the catalogue now, so it needs both.
  return render(
    <ThemeProvider>
      <I18nProvider>
        <ThemeToggle />
        <Probe />
      </I18nProvider>
    </ThemeProvider>,
  )
}

const applied = () => document.documentElement.dataset.theme
const state = () => screen.getByText(/\//).textContent

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  setSystemDark(false)
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * The theme is a palette swap on the document element, so what matters is that
 * the right value lands there — every component reads tokens and never asks
 * which theme is on.
 */
describe('choosing a theme', () => {
  it('follows the operating system until someone says otherwise', () => {
    setSystemDark(true)
    renderTheme()

    expect(state()).toBe('system/dark')
    expect(applied()).toBe('dark')
  })

  it('follows a light operating system too', () => {
    renderTheme()

    expect(state()).toBe('system/light')
    expect(applied()).toBe('light')
  })

  it('applies an explicit choice', async () => {
    renderTheme()

    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(applied()).toBe('dark')
  })

  // Otherwise the choice lasts until the tab is closed, which reads as the
  // setting not working rather than as the setting not being saved.
  it('remembers the choice for next time', async () => {
    renderTheme()

    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
  })

  it('restores a stored choice on the next visit', () => {
    localStorage.setItem(THEME_KEY, 'dark')

    renderTheme()

    expect(state()).toBe('dark/dark')
    expect(applied()).toBe('dark')
  })

  // The whole reason for a third state: an explicit light choice has to win
  // against a dark OS, or "light" would silently mean "dark" for those people.
  it('lets an explicit light choice override a dark operating system', () => {
    setSystemDark(true)
    localStorage.setItem(THEME_KEY, 'light')

    renderTheme()

    expect(applied()).toBe('light')
  })

  it('goes back to following the system when Auto is chosen again', async () => {
    setSystemDark(true)
    localStorage.setItem(THEME_KEY, 'light')
    renderTheme()

    await userEvent.click(screen.getByRole('radio', { name: 'Auto' }))

    expect(state()).toBe('system/dark')
    expect(applied()).toBe('dark')
  })

  it('ignores a stored value that is not a theme', () => {
    localStorage.setItem(THEME_KEY, 'chartreuse')

    renderTheme()

    expect(state()).toBe('system/light')
  })

  it('reacts when the operating system switches while the app is open', () => {
    const system = setSystemDark(false)
    renderTheme()
    expect(applied()).toBe('light')

    system.change(true)

    expect(applied()).toBe('dark')
  })

  // Private browsing and blocked storage both throw on access. A forgotten
  // preference is a nuisance; a blank page is not.
  it('still works when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    renderTheme()
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(applied()).toBe('dark')
  })
})

describe('the toggle', () => {
  it('offers all three states', () => {
    renderTheme()

    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Light',
      'Dark',
      'Auto',
    ])
  })

  it('marks the current one as chosen, so the control says where you are', async () => {
    renderTheme()

    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked()

    await userEvent.click(screen.getByRole('radio', { name: 'Light' }))

    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Auto' })).not.toBeChecked()
  })
})

describe('useTheme outside a provider', () => {
  it('says so rather than handing back a silently wrong theme', () => {
    // React logs the thrown error; the test asserts it, so silence the noise.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow(/ThemeProvider/)

    consoleError.mockRestore()
  })
})
