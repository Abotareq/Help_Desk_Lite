import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as requestsApi from '../../api/requests'
import { makeUser, renderWithProviders } from '../../test/render'
import { RequestCategory, RequestStatus, type SupportRequest } from '../../types/domain'
import { CategoryControl } from './CategoryControl'

const assignee = makeUser({ id: 'u-assignee', name: 'Sam Agent', role: 'AGENT' })

function requestWith(overrides: Partial<SupportRequest> = {}): SupportRequest {
  return {
    id: 'r-1',
    reference: 'HD-000001',
    title: 'The east stairwell door will not latch',
    description: 'It swings back open overnight.',
    category: RequestCategory.IT,
    priority: 'MEDIUM',
    status: RequestStatus.IN_PROGRESS,
    requesterId: 'u-requester',
    assigneeId: assignee.id,
    history: [],
    resolvedAt: null,
    closedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

let changeCategory: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  changeCategory = vi
    .spyOn(requestsApi, 'changeCategory')
    .mockResolvedValue(requestWith({ category: RequestCategory.FACILITIES }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

const dropdown = () => screen.getByRole('combobox', { name: 'Category' })

describe('the category control', () => {
  it('shows the category the request currently has', () => {
    renderWithProviders(<CategoryControl request={requestWith()} />, { user: assignee })

    expect(dropdown()).toHaveValue(RequestCategory.IT)
  })

  it('offers the whole fixed list', () => {
    renderWithProviders(<CategoryControl request={requestWith()} />, { user: assignee })

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'IT',
      'HR',
      'Facilities',
      'Other',
    ])
  })

  // FACILITIES in a sentence reads as shouting, and the stored constant is a
  // storage detail nobody should have to see.
  it('shows categories as words rather than as stored constants', () => {
    renderWithProviders(<CategoryControl request={requestWith()} />, { user: assignee })

    expect(screen.getByRole('option', { name: 'Facilities' })).toHaveValue(
      RequestCategory.FACILITIES,
    )
  })

  it('sends the change when a different category is picked', async () => {
    renderWithProviders(<CategoryControl request={requestWith()} />, { user: assignee })

    await userEvent.selectOptions(dropdown(), RequestCategory.FACILITIES)

    await waitFor(() => {
      expect(changeCategory).toHaveBeenCalledWith('r-1', RequestCategory.FACILITIES)
    })
  })

  it('surfaces the API message rather than a generic one when it is refused', async () => {
    const { ApiError } = await import('../../api/client')
    changeCategory.mockRejectedValue(
      new ApiError(422, 'UNPROCESSABLE_ENTITY', 'A closed request cannot be recategorised'),
    )

    renderWithProviders(<CategoryControl request={requestWith()} />, { user: assignee })
    await userEvent.selectOptions(dropdown(), RequestCategory.HR)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A closed request cannot be recategorised',
    )
  })
})
