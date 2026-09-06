import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../features/auth/authContext'
import { UserRole, type User } from '../types/domain'

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    email: 'person@example.com',
    name: 'Test Person',
    role: UserRole.EMPLOYEE,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  /** Signed-in user, or null for an anonymous visitor. */
  user?: User | null
  initialEntries?: string[]
  /** Mirrors the provider's first-load state while a stored token is verified. */
  initialising?: boolean
}

/**
 * Renders a component inside the providers it actually depends on, with auth
 * stubbed rather than driven through the network — so a test can say "as a
 * manager" without logging anything in.
 */
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { user = makeUser(), initialEntries = ['/'], initialising = false, ...rest } = options

  const auth: AuthContextValue = {
    user,
    initialising,
    signIn: async () => undefined,
    signOut: () => undefined,
  }

  // Retries would turn an expected failure into a slow one.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...rest }) }
}
