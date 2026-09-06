import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { makeUser, renderWithProviders } from '../../test/render'
import { RequestStatus, UserRole, type SupportRequest } from '../../types/domain'
import { StatusActions } from './StatusActions'

const requester = makeUser({ id: 'u-requester', name: 'Eve Employee' })
const assignee = makeUser({ id: 'u-assignee', name: 'Sam Agent', role: UserRole.AGENT })
const bystander = makeUser({ id: 'u-other', name: 'Alex Agent', role: UserRole.AGENT })
const manager = makeUser({ id: 'u-manager', name: 'Mo Manager', role: UserRole.MANAGER })

function requestWith(overrides: Partial<SupportRequest> = {}): SupportRequest {
  return {
    id: 'r-1',
    reference: 'HD-000001',
    title: 'Laptop will not boot',
    description: 'It restarts in a loop.',
    category: 'IT',
    priority: 'HIGH',
    status: RequestStatus.NEW,
    requesterId: requester.id,
    assigneeId: null,
    history: [],
    resolvedAt: null,
    closedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderActions(request: SupportRequest, viewer = requester, onMove = vi.fn()) {
  renderWithProviders(
    <StatusActions request={request} viewer={viewer} pending={false} error={null} onMove={onMove} />,
    { user: viewer },
  )
  return { onMove }
}

/**
 * Every button the component is currently offering. `queryAllByRole` rather
 * than `getAllByRole`: offering nothing is a valid outcome here, and the
 * getter would throw instead of returning an empty list.
 */
function offered(): string[] {
  return screen.queryAllByRole('button').map((b) => b.textContent?.trim() ?? '')
}

/**
 * The component that decides what a person may do to a request. It reads the
 * workflow mirror, so this is where "the UI must never offer a move the API
 * would refuse" is actually enforced for a human.
 */
describe('what each person is offered', () => {
  it('lets a requester withdraw a NEW request, and nothing else', () => {
    renderActions(requestWith())

    expect(offered()).toEqual(['Withdraw'])
  })

  it('offers a requester nothing while a handler is working it', () => {
    renderActions(
      requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: assignee.id }),
      requester,
    )

    expect(screen.getByText('You have no actions on this request.')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('lets a requester resume a request waiting on them', () => {
    renderActions(requestWith({ status: RequestStatus.WAITING, assigneeId: assignee.id }), requester)

    expect(offered()).toEqual(['Resume'])
  })

  it('offers a requester reopen and close once resolved', () => {
    renderActions(
      requestWith({ status: RequestStatus.RESOLVED, assigneeId: assignee.id }),
      requester,
    )

    expect(offered().sort()).toEqual(['Close', 'Reopen'])
  })

  it('never offers a requester a resolve', () => {
    renderActions(
      requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: assignee.id }),
      requester,
    )

    expect(offered()).not.toContain('Resolve')
  })

  it('offers the assignee wait and resolve on work in progress', () => {
    renderActions(
      requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: assignee.id }),
      assignee,
    )

    expect(offered().sort()).toEqual(['Resolve', 'Wait on requester'])
  })

  it('offers an unrelated agent nothing on work they do not own', () => {
    renderActions(
      requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: assignee.id }),
      bystander,
    )

    expect(screen.getByText('You have no actions on this request.')).toBeInTheDocument()
  })

  it('offers a manager the handler moves on anything', () => {
    renderActions(
      requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: assignee.id }),
      manager,
    )

    expect(offered().sort()).toEqual(['Resolve', 'Wait on requester'])
  })

  it('says CLOSED is final rather than showing an empty panel', () => {
    renderActions(requestWith({ status: RequestStatus.CLOSED, assigneeId: assignee.id }), manager)

    expect(screen.getByText(/closed. Nothing moves out of it/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})

describe('making a move', () => {
  it('confirms before acting, rather than firing on the first click', async () => {
    const { onMove } = renderActions(requestWith())

    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }))

    expect(onMove).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('passes the target status and the note through', async () => {
    const { onMove } = renderActions(
      requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: assignee.id }),
      assignee,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Wait on requester' }))
    await userEvent.type(screen.getByRole('textbox'), 'Need your asset tag')
    await userEvent.click(screen.getByRole('button', { name: 'Wait on requester' }))

    expect(onMove).toHaveBeenCalledWith(RequestStatus.WAITING, 'Need your asset tag')
  })

  it('sends no note when the box is left blank', async () => {
    const { onMove } = renderActions(requestWith())

    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }))

    expect(onMove).toHaveBeenCalledWith(RequestStatus.CLOSED, undefined)
  })

  it('treats whitespace as blank rather than sending it as a note', async () => {
    const { onMove } = renderActions(requestWith())

    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    await userEvent.type(screen.getByRole('textbox'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }))

    expect(onMove).toHaveBeenCalledWith(RequestStatus.CLOSED, undefined)
  })

  // A request on hold without a reason is the ambiguity the PRD exists to remove.
  it('asks what is needed when putting a request on hold', async () => {
    renderActions(
      requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: assignee.id }),
      assignee,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Wait on requester' }))

    expect(screen.getByPlaceholderText('What do you need from the requester?')).toBeInTheDocument()
  })

  it('does not demand a reason for other moves', async () => {
    renderActions(
      requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: assignee.id }),
      assignee,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))

    expect(screen.getByPlaceholderText('Add a note (optional)')).toBeInTheDocument()
  })

  it('backs out without acting on cancel', async () => {
    const { onMove } = renderActions(requestWith())

    await userEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onMove).not.toHaveBeenCalled()
    expect(offered()).toEqual(['Withdraw'])
  })
})

describe('when the API refuses', () => {
  it('shows the API message rather than a generic one', () => {
    renderWithProviders(
      <StatusActions
        request={requestWith()}
        viewer={requester}
        pending={false}
        error={new ApiError(422, 'UNPROCESSABLE_ENTITY', 'CLOSED is final — nothing moves out of it')}
        onMove={vi.fn()}
      />,
      { user: requester },
    )

    expect(screen.getByRole('alert')).toHaveTextContent('CLOSED is final')
  })
})
