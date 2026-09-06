import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeUser, renderWithProviders } from '../../test/render'
import { NewRequestPage } from './NewRequestPage'

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function render() {
  return renderWithProviders(<NewRequestPage />, { user: makeUser() })
}

async function fillValid() {
  await userEvent.type(screen.getByLabelText('What do you need?'), 'Laptop will not boot')
  await userEvent.type(
    screen.getByLabelText('Details'),
    'It powers on, shows the logo, then restarts in a loop.',
  )
  await userEvent.selectOptions(screen.getByLabelText('Category'), 'IT')
}

describe('the submission form', () => {
  it('will not submit until a category is chosen', async () => {
    render()

    await userEvent.type(screen.getByLabelText('What do you need?'), 'Something')

    expect(screen.getByRole('button', { name: 'Submit request' })).toBeDisabled()
  })

  it('enables submission once the required structured field is set', async () => {
    render()

    await fillValid()

    expect(screen.getByRole('button', { name: 'Submit request' })).toBeEnabled()
  })

  it('defaults priority to Medium, so submitting stays a one-minute job', () => {
    render()

    expect(screen.getByLabelText('Priority')).toHaveValue('MEDIUM')
  })

  it('offers only the categories the API accepts', () => {
    render()

    const values = Array.from(
      screen.getByLabelText<HTMLSelectElement>('Category').options,
      (o) => o.value,
    ).filter(Boolean)

    expect(values).toEqual(['IT', 'HR', 'FACILITIES', 'OTHER'])
  })

  it('sends what the user entered', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { request: { id: 'r-1' } }))
    render()

    await fillValid()
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/requests')
    expect(JSON.parse(init.body)).toMatchObject({
      title: 'Laptop will not boot',
      category: 'IT',
      priority: 'MEDIUM',
    })
  })
})

/**
 * The API returns an `error.details` array of `{ field, message }`. Rendering
 * each message against its own input — rather than one banner at the top — is
 * the whole reason ApiError keeps that array instead of flattening it.
 */
describe('when the API rejects the submission', () => {
  const validationFailure = jsonResponse(400, {
    error: {
      code: 'BAD_REQUEST',
      message: 'Validation failed',
      details: [
        { field: 'title', message: 'Title must be at least 5 characters' },
        { field: 'description', message: 'Describe the issue in at least 15 characters' },
      ],
    },
  })

  it('puts each message against the field it blames', async () => {
    fetchMock.mockResolvedValue(validationFailure)
    render()

    await fillValid()
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(await screen.findByText('Title must be at least 5 characters')).toBeInTheDocument()
    expect(
      screen.getByText('Describe the issue in at least 15 characters'),
    ).toBeInTheDocument()
  })

  it('marks the blamed inputs invalid for assistive technology', async () => {
    fetchMock.mockResolvedValue(validationFailure)
    render()

    await fillValid()
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }))

    await waitFor(() =>
      expect(screen.getByLabelText('What do you need?')).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(screen.getByLabelText('Category')).not.toHaveAttribute('aria-invalid')
  })

  it('keeps what the user typed rather than clearing the form', async () => {
    fetchMock.mockResolvedValue(validationFailure)
    render()

    await fillValid()
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }))

    await screen.findByText('Title must be at least 5 characters')
    expect(screen.getByLabelText('What do you need?')).toHaveValue('Laptop will not boot')
  })

  // A failure with no field attached would otherwise vanish silently.
  it('shows an unattached message as an alert', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'Your account is deactivated' } }),
    )
    render()

    await fillValid()
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your account is deactivated')
  })
})
