import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { makeUser, renderWithProviders } from '../../test/render'
import { RequestStatus, UserRole, type SupportRequest } from '../../types/domain'
import { CommentForm } from './CommentForm'

const requester = makeUser({ id: 'u-requester', name: 'Eve Employee' })
const assignee = makeUser({ id: 'u-assignee', name: 'Sam Agent', role: UserRole.AGENT })
const manager = makeUser({ id: 'u-manager', name: 'Mo Manager', role: UserRole.MANAGER })

function requestWith(overrides: Partial<SupportRequest> = {}): SupportRequest {
  return {
    id: 'r-1',
    reference: 'HD-000001',
    title: 'Docking station drops the monitor',
    description: 'The second screen goes black after a redock.',
    category: 'IT',
    priority: 'MEDIUM',
    status: RequestStatus.IN_PROGRESS,
    requesterId: requester.id,
    assigneeId: assignee.id,
    history: [],
    resolvedAt: null,
    closedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderForm(viewer = requester, request = requestWith(), onPost = vi.fn()) {
  renderWithProviders(
    <CommentForm request={request} viewer={viewer} pending={false} error={null} onPost={onPost} />,
    { user: viewer },
  )
  return { onPost }
}

const box = () => screen.getByRole('textbox', { name: 'Add a comment' })
const internalToggle = () => screen.queryByRole('checkbox', { name: 'Internal note' })

describe('posting a comment', () => {
  it('sends what was typed, as a public comment by default', async () => {
    const { onPost } = renderForm()

    await userEvent.type(box(), 'It happened again this morning')
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }))

    expect(onPost).toHaveBeenCalledWith('It happened again this morning', false)
  })

  it('clears the box afterwards, so the next comment starts empty', async () => {
    renderForm()

    await userEvent.type(box(), 'Something')
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }))

    expect(box()).toHaveValue('')
  })

  it('will not send an empty comment', async () => {
    const { onPost } = renderForm()

    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }))

    expect(onPost).not.toHaveBeenCalled()
  })

  it('treats whitespace as empty', async () => {
    const { onPost } = renderForm()

    await userEvent.type(box(), '    ')

    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled()
    expect(onPost).not.toHaveBeenCalled()
  })

  it('trims what it sends', async () => {
    const { onPost } = renderForm()

    await userEvent.type(box(), '  spaced out  ')
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }))

    expect(onPost).toHaveBeenCalledWith('spaced out', false)
  })

  it('shows the API message when a post is refused', () => {
    renderWithProviders(
      <CommentForm
        request={requestWith()}
        viewer={requester}
        pending={false}
        error={new ApiError(422, 'UNPROCESSABLE_ENTITY', 'A closed request cannot be commented on')}
        onPost={vi.fn()}
      />,
      { user: requester },
    )

    expect(screen.getByRole('alert')).toHaveTextContent('A closed request cannot be commented on')
  })
})

/**
 * The same rule as the status buttons: never offer a control the API would
 * refuse. A requester sending an "internal" note believing it was private would
 * be worse than not offering it at all.
 */
describe('the internal note option', () => {
  it('is not offered to the requester', () => {
    renderForm(requester)

    expect(internalToggle()).not.toBeInTheDocument()
  })

  it('is offered to the assignee', () => {
    renderForm(assignee)

    expect(internalToggle()).toBeInTheDocument()
  })

  it('is offered to a manager', () => {
    renderForm(manager)

    expect(internalToggle()).toBeInTheDocument()
  })

  it('is not offered to an agent who does not own the request', () => {
    const bystander = makeUser({ id: 'u-other', name: 'Alex Agent', role: UserRole.AGENT })

    renderForm(bystander, requestWith({ assigneeId: null }))

    expect(internalToggle()).not.toBeInTheDocument()
  })

  it('marks the comment internal when it is ticked', async () => {
    const { onPost } = renderForm(assignee)

    await userEvent.click(internalToggle()!)
    await userEvent.type(box(), 'Third dock this month')
    await userEvent.click(screen.getByRole('button', { name: 'Add internal note' }))

    expect(onPost).toHaveBeenCalledWith('Third dock this month', true)
  })

  it('says out loud that the requester will not see it', async () => {
    renderForm(assignee)

    await userEvent.click(internalToggle()!)

    expect(screen.getByPlaceholderText(/requester will not see it/i)).toBeInTheDocument()
  })

  it('goes back to a public comment after one is posted', async () => {
    const { onPost } = renderForm(assignee)

    await userEvent.click(internalToggle()!)
    await userEvent.type(box(), 'Internal')
    await userEvent.click(screen.getByRole('button', { name: 'Add internal note' }))

    await userEvent.type(box(), 'Public')
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }))

    expect(onPost).toHaveBeenNthCalledWith(1, 'Internal', true)
    expect(onPost).toHaveBeenNthCalledWith(2, 'Public', false)
  })
})
