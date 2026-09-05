/**
 * The v1 workflow. Resolved from the PRD's open question on states — deliberately
 * small, because ambiguous states are the exact failure this project exists to fix.
 */
export enum RequestStatus {
  /** Submitted, nobody owns it yet. */
  NEW = 'NEW',
  /** Owned and being worked. */
  IN_PROGRESS = 'IN_PROGRESS',
  /** Blocked on the requester — the handler still owns it. */
  WAITING = 'WAITING',
  /** Handler believes it is done; the requester can still reopen. */
  RESOLVED = 'RESOLVED',
  /** Terminal. Nothing moves out of here. */
  CLOSED = 'CLOSED',
}

export const REQUEST_STATUSES = Object.values(RequestStatus);

/** Statuses that still need someone's attention — the manager dashboard's "open". */
export const OPEN_STATUSES: readonly RequestStatus[] = [
  RequestStatus.NEW,
  RequestStatus.IN_PROGRESS,
  RequestStatus.WAITING,
];

export function isOpen(status: RequestStatus): boolean {
  return OPEN_STATUSES.includes(status);
}
