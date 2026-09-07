import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RequestStatus, type RequestComment, type RequestHistoryEntry } from '../../types/domain'
import { Timeline } from './Timeline'

const names = new Map([
  ['u-employee', 'Eve Employee'],
  ['u-agent', 'Sam Agent'],
])

function event(overrides: Partial<RequestHistoryEntry> = {}): RequestHistoryEntry {
  return {
    type: 'STATUS_CHANGED',
    fromStatus: RequestStatus.NEW,
    toStatus: RequestStatus.IN_PROGRESS,
    actorId: 'u-agent',
    at: '2026-01-01T10:00:00.000Z',
    ...overrides,
  }
}

function comment(overrides: Partial<RequestComment> = {}): RequestComment {
  return {
    id: 'c-1',
    requestId: 'r-1',
    authorId: 'u-employee',
    body: 'Still broken',
    isInternal: false,
    at: '2026-01-01T11:00:00.000Z',
    ...overrides,
  }
}

/** The rendered order of the timeline, one line per entry. */
function lines(): string[] {
  return screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
}

/**
 * The request has to tell its whole story in one place. History and comments
 * arrive from two endpoints — an internal note must not ride along on a request
 * payload — so this is where the two become a single chronological account.
 */
describe('interleaving', () => {
  it('puts events and comments in one list, oldest first', () => {
    render(
      <Timeline
        names={names}
        history={[
          event({ type: 'CREATED', fromStatus: null, toStatus: RequestStatus.NEW, actorId: 'u-employee', at: '2026-01-01T09:00:00.000Z' }),
          event({ at: '2026-01-01T12:00:00.000Z', fromStatus: RequestStatus.IN_PROGRESS, toStatus: RequestStatus.WAITING }),
        ]}
        comments={[
          comment({ id: 'c-1', body: 'Any news?', at: '2026-01-01T10:00:00.000Z' }),
          comment({ id: 'c-2', body: 'Send your asset tag', authorId: 'u-agent', at: '2026-01-01T13:00:00.000Z' }),
        ]}
      />,
    )

    expect(lines().map((line) => line.slice(0, 40))).toEqual([
      expect.stringContaining('Eve Employee submitted this request'),
      expect.stringContaining('Eve Employee commented'),
      expect.stringContaining('Sam Agent moved it'),
      expect.stringContaining('Sam Agent commented'),
    ])
  })

  // One call can carry both a move and its message, which gives them the same
  // timestamp. The move has to read first, or the answer appears before the
  // question it answers.
  it('reads the move before the message when they share a timestamp', () => {
    const at = '2026-01-01T10:00:00.000Z'
    render(
      <Timeline
        names={names}
        history={[event({ at, toStatus: RequestStatus.WAITING })]}
        comments={[comment({ at, body: 'What is your asset tag?', authorId: 'u-agent' })]}
      />,
    )

    expect(lines()[0]).toContain('moved it')
    expect(lines()[1]).toContain('What is your asset tag?')
  })

  it('shows the comment body, not just that somebody commented', () => {
    render(<Timeline names={names} history={[]} comments={[comment({ body: 'It is still down' })]} />)

    expect(screen.getByText('It is still down')).toBeInTheDocument()
  })

  it('falls back to a person-shaped label for an id it has no name for', () => {
    render(
      <Timeline
        names={new Map()}
        history={[]}
        comments={[comment({ authorId: 'u-unknown', body: 'Hello' })]}
      />,
    )

    expect(screen.getByText('Someone commented')).toBeInTheDocument()
    expect(screen.queryByText(/u-unknown/)).not.toBeInTheDocument()
  })

  it('says so when there is nothing to show at all', () => {
    render(<Timeline names={names} history={[]} comments={[]} />)

    expect(screen.getByText('Nothing has happened yet.')).toBeInTheDocument()
  })

  it('still renders history on its own, for a request nobody has commented on', () => {
    render(<Timeline names={names} history={[event()]} comments={[]} />)

    expect(lines()).toHaveLength(1)
    expect(lines()[0]).toContain('Sam Agent moved it')
  })
})

/**
 * An internal note reaching this component has already been cleared by the API —
 * it filters the thread for whoever asked. What matters here is that whoever
 * *can* see one is told it is internal, so nobody writes "the user is wrong
 * again" believing it is private and finds out otherwise.
 */
describe('internal notes', () => {
  it('marks an internal note as such', () => {
    render(
      <Timeline
        names={names}
        history={[]}
        comments={[comment({ isInternal: true, body: 'Third dock this month', authorId: 'u-agent' })]}
      />,
    )

    expect(within(screen.getByRole('listitem')).getByText('Internal note')).toBeInTheDocument()
  })

  it('leaves an ordinary comment unmarked', () => {
    render(<Timeline names={names} history={[]} comments={[comment()]} />)

    expect(screen.queryByText('Internal note')).not.toBeInTheDocument()
  })
})
