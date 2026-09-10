import type { MessageKey } from '../i18n/en'
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
  /**
   * Message key for the verb on the button, rather than the raw target status.
   * A key rather than the text itself, so the table stays the single statement
   * of what the workflow is and the words come from the reader's catalogue.
   */
  label: MessageKey
}

const HANDLER: readonly Relation[] = ['ASSIGNEE', 'MANAGER']

export const TRANSITIONS: readonly Transition[] = [
  { from: RequestStatus.NEW, to: RequestStatus.IN_PROGRESS, allowed: HANDLER, label: 'workflow.startWork' },
  {
    from: RequestStatus.NEW,
    to: RequestStatus.CLOSED,
    allowed: ['REQUESTER', 'MANAGER'],
    label: 'workflow.withdraw',
  },
  { from: RequestStatus.IN_PROGRESS, to: RequestStatus.WAITING, allowed: HANDLER, label: 'workflow.wait' },
  { from: RequestStatus.IN_PROGRESS, to: RequestStatus.RESOLVED, allowed: HANDLER, label: 'workflow.resolve' },
  {
    from: RequestStatus.WAITING,
    to: RequestStatus.IN_PROGRESS,
    allowed: [...HANDLER, 'REQUESTER'],
    label: 'workflow.resume',
  },
  { from: RequestStatus.WAITING, to: RequestStatus.RESOLVED, allowed: HANDLER, label: 'workflow.resolve' },
  {
    from: RequestStatus.RESOLVED,
    to: RequestStatus.IN_PROGRESS,
    allowed: ['REQUESTER', ...HANDLER],
    isReopen: true,
    label: 'workflow.reopen',
  },
  {
    from: RequestStatus.RESOLVED,
    to: RequestStatus.CLOSED,
    allowed: ['REQUESTER', ...HANDLER],
    label: 'workflow.close',
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
  label: MessageKey
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

/**
 * Who may join the conversation, mirroring RequestService.assertMayComment.
 *
 * Holding any relation is enough — whoever raised it, whoever owns it, and
 * managers. An agent browsing an unclaimed request can read the thread but has
 * nothing to say about work they have not taken, so the composer is not offered
 * until they claim it. Nothing is added to a closed request; it is finished.
 */
export function canComment(request: SupportRequest, viewer: User): boolean {
  return !isTerminal(request.status) && relationsOf(request, viewer).size > 0
}

/**
 * Who may write an internal note: the handlers of this request, the same pair
 * the transition table calls a handler. Being an agent is not enough — an agent
 * reading a request they raised themselves is its requester, not its handler.
 */
export function canWriteInternalNote(request: SupportRequest, viewer: User): boolean {
  const relations = relationsOf(request, viewer)
  return relations.has('ASSIGNEE') || relations.has('MANAGER')
}

/**
 * Mirrors RequestService.changeCategory. Whoever raises a request picks from a
 * fixed list and regularly picks wrong; the handler who picks it up is the one
 * who knows where it belongs. The requester is deliberately not offered the
 * control — the API refuses them, and offering it would teach that rule with a
 * 403 instead of with the absence of a dropdown.
 */
export function canChangeCategory(request: SupportRequest, viewer: User): boolean {
  if (isTerminal(request.status)) return false

  const relations = relationsOf(request, viewer)
  return relations.has('ASSIGNEE') || relations.has('MANAGER')
}

/**
 * Agents only. Managers direct the work rather than doing it — they assign it,
 * or move its status, but the queue belongs to the agents.
 */
export function canClaim(request: SupportRequest, viewer: User): boolean {
  return (
    request.assigneeId === null && !isTerminal(request.status) && viewer.role === UserRole.AGENT
  )
}
