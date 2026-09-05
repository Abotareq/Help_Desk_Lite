import { RequestStatus, UserRole, type SupportRequest, type User } from '../types/domain'

/**
 * A mirror of backend/src/domain/workflow/transitions.ts.
 *
 * The API is the authority — it re-checks every move and will refuse an illegal
 * one with a 422. This copy exists so the UI never *offers* a control the API
 * would reject: showing a "Resolve" button to someone who cannot resolve is a
 * worse experience than not showing it, and the round trip teaches nothing.
 *
 * If the backend table changes, this has to change with it. The pairing is
 * asserted in workflow.test.ts.
 */
type Relation = 'REQUESTER' | 'ASSIGNEE' | 'MANAGER'

interface Transition {
  from: RequestStatus
  to: RequestStatus
  allowed: readonly Relation[]
  isReopen?: boolean
  /** Verb shown on the button, rather than the raw target status. */
  label: string
}

const HANDLER: readonly Relation[] = ['ASSIGNEE', 'MANAGER']

export const TRANSITIONS: readonly Transition[] = [
  { from: RequestStatus.NEW, to: RequestStatus.IN_PROGRESS, allowed: HANDLER, label: 'Start work' },
  {
    from: RequestStatus.NEW,
    to: RequestStatus.CLOSED,
    allowed: ['REQUESTER', 'MANAGER'],
    label: 'Withdraw',
  },
  { from: RequestStatus.IN_PROGRESS, to: RequestStatus.WAITING, allowed: HANDLER, label: 'Wait on requester' },
  { from: RequestStatus.IN_PROGRESS, to: RequestStatus.RESOLVED, allowed: HANDLER, label: 'Resolve' },
  {
    from: RequestStatus.WAITING,
    to: RequestStatus.IN_PROGRESS,
    allowed: [...HANDLER, 'REQUESTER'],
    label: 'Resume',
  },
  { from: RequestStatus.WAITING, to: RequestStatus.RESOLVED, allowed: HANDLER, label: 'Resolve' },
  {
    from: RequestStatus.RESOLVED,
    to: RequestStatus.IN_PROGRESS,
    allowed: ['REQUESTER', ...HANDLER],
    isReopen: true,
    label: 'Reopen',
  },
  {
    from: RequestStatus.RESOLVED,
    to: RequestStatus.CLOSED,
    allowed: ['REQUESTER', ...HANDLER],
    label: 'Close',
  },
]

/** The relations this viewer holds for this particular request. */
export function relationsOf(request: SupportRequest, viewer: User): Set<Relation> {
  const relations = new Set<Relation>()
  if (request.requesterId === viewer.id) relations.add('REQUESTER')
  if (request.assigneeId === viewer.id) relations.add('ASSIGNEE')
  if (viewer.role === UserRole.MANAGER) relations.add('MANAGER')
  return relations
}

export interface AvailableAction {
  to: RequestStatus
  label: string
  isReopen: boolean
}

/** The moves this viewer may actually make on this request, right now. */
export function availableActions(request: SupportRequest, viewer: User): AvailableAction[] {
  const relations = relationsOf(request, viewer)

  return TRANSITIONS.filter(
    (t) => t.from === request.status && t.allowed.some((r) => relations.has(r)),
  ).map((t) => ({ to: t.to, label: t.label, isReopen: t.isReopen ?? false }))
}

export function isTerminal(status: RequestStatus): boolean {
  return TRANSITIONS.every((t) => t.from !== status)
}

export function canClaim(request: SupportRequest, viewer: User): boolean {
  return (
    request.assigneeId === null &&
    !isTerminal(request.status) &&
    (viewer.role === UserRole.AGENT || viewer.role === UserRole.MANAGER)
  )
}
