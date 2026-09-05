import { RequestStatus } from '../enums/RequestStatus';

/**
 * Who is allowed to move a request, relative to the request itself.
 *
 * These are relationships, not roles: "the person who raised it" and "the person
 * who owns it" are what the rules actually turn on. The service resolves an actor
 * into the set of relations they hold for a given request.
 */
export enum ActorRelation {
  /** Raised the request. */
  REQUESTER = 'REQUESTER',
  /** Currently owns the request. */
  ASSIGNEE = 'ASSIGNEE',
  /** A manager — holds this on every request. */
  MANAGER = 'MANAGER',
}

export interface TransitionRule {
  from: RequestStatus;
  to: RequestStatus;
  /** Any one of these relations is enough to perform the move. */
  allowed: readonly ActorRelation[];
  /** Set when this move is a reopen, so history records it as such. */
  isReopen?: boolean;
  /** Refused with this message when the mover holds none of the relations. */
  deniedMessage: string;
}

const HANDLER: readonly ActorRelation[] = [ActorRelation.ASSIGNEE, ActorRelation.MANAGER];

/**
 * The whole v1 workflow, in one table.
 *
 *   NEW ──▶ IN_PROGRESS ⇄ WAITING
 *            │     ▲          │
 *            ▼     └── reopen ┘
 *         RESOLVED ──▶ CLOSED
 *
 * Anything absent from this table is not a legal move. Keeping it declarative is
 * the point: the states were the PRD's biggest open question, and a table can be
 * read against the answer without tracing branches through a service.
 */
export const TRANSITIONS: readonly TransitionRule[] = [
  {
    from: RequestStatus.NEW,
    to: RequestStatus.IN_PROGRESS,
    allowed: HANDLER,
    deniedMessage: 'Only the assignee or a manager can start work on a request',
  },
  {
    from: RequestStatus.NEW,
    to: RequestStatus.CLOSED,
    // Withdrawing something you raised before anyone picks it up.
    allowed: [ActorRelation.REQUESTER, ActorRelation.MANAGER],
    deniedMessage: 'Only the requester or a manager can close a request that has not been started',
  },
  {
    from: RequestStatus.IN_PROGRESS,
    to: RequestStatus.WAITING,
    allowed: HANDLER,
    deniedMessage: 'Only the assignee or a manager can put a request on hold',
  },
  {
    from: RequestStatus.IN_PROGRESS,
    to: RequestStatus.RESOLVED,
    allowed: HANDLER,
    deniedMessage: 'Only the assignee or a manager can resolve a request',
  },
  {
    from: RequestStatus.WAITING,
    to: RequestStatus.IN_PROGRESS,
    // The requester answering the question is what unblocks it, so they can too.
    allowed: [...HANDLER, ActorRelation.REQUESTER],
    deniedMessage: 'Only the requester, the assignee or a manager can resume a waiting request',
  },
  {
    from: RequestStatus.WAITING,
    to: RequestStatus.RESOLVED,
    allowed: HANDLER,
    deniedMessage: 'Only the assignee or a manager can resolve a request',
  },
  {
    from: RequestStatus.RESOLVED,
    to: RequestStatus.IN_PROGRESS,
    // The reopen flow: resolved is a claim, not a fact, and the person who
    // raised it is the one who knows whether it actually got fixed.
    allowed: [ActorRelation.REQUESTER, ...HANDLER],
    isReopen: true,
    deniedMessage: 'Only the requester, the assignee or a manager can reopen a request',
  },
  {
    from: RequestStatus.RESOLVED,
    to: RequestStatus.CLOSED,
    allowed: [ActorRelation.REQUESTER, ...HANDLER],
    deniedMessage: 'Only the requester, the assignee or a manager can close a resolved request',
  },
];

export interface TransitionLookup {
  rule: TransitionRule | null;
  /** True when `from` has no outgoing moves at all — a terminal state. */
  fromIsTerminal: boolean;
}

export function findTransition(from: RequestStatus, to: RequestStatus): TransitionLookup {
  const outgoing = TRANSITIONS.filter((t) => t.from === from);
  return {
    rule: outgoing.find((t) => t.to === to) ?? null,
    fromIsTerminal: outgoing.length === 0,
  };
}

/** The moves available from a state — used to explain a rejection usefully. */
export function nextStatuses(from: RequestStatus): RequestStatus[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}
