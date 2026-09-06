import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeUser, renderWithProviders } from '../../test/render'
import { UserRole } from '../../types/domain'
import { ResetPasswordDialog } from './ResetPasswordDialog'

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const target = makeUser({ id: 'u-target', name: 'Sam Agent', role: UserRole.AGENT })
const manager = makeUser({ id: 'u-manager', name: 'Mo Manager', role: UserRole.MANAGER })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function render(onClose = vi.fn()) {
  renderWithProviders(<ResetPasswordDialog user={target} onClose={onClose} />, { user: manager })
  return { onClose }
}

/**
 * v1 has no self-service recovery, so a manager doing this is the only route
 * back in for somebody locked out.
 */
describe('resetting a password', () => {
  it('names the person whose password is being changed', () => {
    render()

    expect(screen.getByText(/Set a new password for/)).toBeInTheDocument()
    expect(screen.getByText('Sam Agent')).toBeInTheDocument()
  })

  it('posts the new password to that user', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: target }))
    render()

    await userEvent.type(screen.getByLabelText('New password'), 'BrandNewPass1')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/users/u-target/password')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ password: 'BrandNewPass1' })
  })

  // Nothing emails it — there are no notifications in v1, so this screen is the
  // only handover point and the password has to be visible here.
  it('shows the new password afterwards, since nothing sends it', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: target }))
    render()

    await userEvent.type(screen.getByLabelText('New password'), 'BrandNewPass1')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('BrandNewPass1')).toBeInTheDocument()
    expect(screen.getByText(/not shown again and nothing sends it/i)).toBeInTheDocument()
  })

  it('renders a rejected password against the field', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          details: [{ field: 'password', message: 'Password must be at least 8 characters' }],
        },
      }),
    )
    render()

    await userEvent.type(screen.getByLabelText('New password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not claim success when the reset failed', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'User not found' } }),
    )
    render()

    await userEvent.type(screen.getByLabelText('New password'), 'BrandNewPass1')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('User not found')
    expect(screen.queryByText(/not shown again/i)).not.toBeInTheDocument()
  })

  it('closes without posting anything on cancel', async () => {
    const { onClose } = render()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('closes from the confirmation', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: target }))
    const { onClose } = render()

    await userEvent.type(screen.getByLabelText('New password'), 'BrandNewPass1')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Done' }))

    expect(onClose).toHaveBeenCalled()
  })
})
