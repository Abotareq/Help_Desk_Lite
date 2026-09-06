import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeUser, renderWithProviders } from '../test/render'
import { UserRole } from '../types/domain'
import { AppRoutes } from './AppRoutes'

/**
 * Route-level role gating, tested directly.
 *
 * This is the bug class that already got through once: the sidebar filtered its
 * links by role, which made the restricted screens *look* unreachable, while an
 * employee typing /dashboard still landed on the manager view. Hiding a link is
 * not access control, and only a test at this level says so.
 */
function renderAt(path: string, role: UserRole | null) {
  return renderWithProviders(<AppRoutes />, {
    user: role ? makeUser({ role, name: `A ${role}` }) : null,
    initialEntries: [path],
  })
}

describe('an anonymous visitor', () => {
  it('is sent to sign-in from a protected route', async () => {
    renderAt('/queue', null)

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('waits rather than flashing sign-in while a stored token is verified', () => {
    renderWithProviders(<AppRoutes />, {
      user: null,
      initialising: true,
      initialEntries: ['/'],
    })

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
  })
})

describe('an employee', () => {
  it('reaches their own requests', async () => {
    renderAt('/', UserRole.EMPLOYEE)

    expect(await screen.findByRole('heading', { name: 'My requests' })).toBeInTheDocument()
  })

  it.each(['/queue', '/all', '/dashboard', '/people'])(
    'is redirected away from %s rather than shown it',
    async (path) => {
      renderAt(path, UserRole.EMPLOYEE)

      // Landing on "My requests" is the redirect target; seeing the restricted
      // heading would mean the route let them through.
      expect(await screen.findByRole('heading', { name: 'My requests' })).toBeInTheDocument()
    },
  )

  it('is not offered the restricted links either', async () => {
    renderAt('/', UserRole.EMPLOYEE)
    await screen.findByRole('heading', { name: 'My requests' })

    expect(screen.queryByRole('link', { name: 'Queue' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'People' })).not.toBeInTheDocument()
  })
})

describe('an agent', () => {
  it('reaches the queue', async () => {
    renderAt('/queue', UserRole.AGENT)

    expect(await screen.findByRole('heading', { name: 'Queue' })).toBeInTheDocument()
  })

  it.each(['/all', '/dashboard', '/people'])(
    'is redirected away from the manager-only %s',
    async (path) => {
      renderAt(path, UserRole.AGENT)

      expect(await screen.findByRole('heading', { name: 'My requests' })).toBeInTheDocument()
    },
  )
})

describe('a manager', () => {
  it.each([
    ['/queue', 'Queue'],
    ['/all', 'All requests'],
    ['/dashboard', 'Dashboard'],
    ['/people', 'People'],
  ])('reaches %s', async (path, heading) => {
    renderAt(path, UserRole.MANAGER)

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })
})

describe('unknown paths', () => {
  it('fall back to the default screen rather than a blank page', async () => {
    renderAt('/nonsense', UserRole.EMPLOYEE)

    expect(await screen.findByRole('heading', { name: 'My requests' })).toBeInTheDocument()
  })
})
