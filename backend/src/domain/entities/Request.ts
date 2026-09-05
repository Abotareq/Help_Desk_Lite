import type { RequestCategory } from '../enums/RequestCategory';
import type { RequestPriority } from '../enums/RequestPriority';
import type { RequestStatus } from '../enums/RequestStatus';

/** What kind of change produced a history entry. */
export type HistoryEventType = 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'UNASSIGNED' | 'REOPENED';

/**
 * One immutable line in a request's history. The PRD requires a basic record of
 * status changes per request; assignment changes land here too, since "who owns
 * this and since when" is the other half of the same question.
 */
export interface RequestHistoryEntry {
  type: HistoryEventType;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actorId: string;
  note?: string;
  at: Date;
}

/** Framework-agnostic shape of a support request. */
export interface SupportRequest {
  id: string;
  /** Human-readable identifier shown to people, e.g. HD-000042. */
  reference: string;
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  requesterId: string;
  /** Single owner. Null until someone claims it or a manager assigns it. */
  assigneeId: string | null;
  history: RequestHistoryEntry[];
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
