import { RequestCategory, RequestStatus } from '../types/domain'

/**
 * Status presentation lives here rather than beside the component, so the badge
 * file exports only a component — which is what keeps Fast Refresh working, and
 * lets non-visual code ask for a label without importing UI.
 */
export const STATUS_STYLES: Record<RequestStatus, { dot: string }> = {
  [RequestStatus.NEW]: { dot: 'bg-status-new' },
  [RequestStatus.IN_PROGRESS]: { dot: 'bg-status-progress' },
  [RequestStatus.WAITING]: { dot: 'bg-status-waiting' },
  [RequestStatus.RESOLVED]: { dot: 'bg-status-resolved' },
  [RequestStatus.CLOSED]: { dot: 'bg-status-closed' },
}

/** The fixed list, in the order the form and the filters offer it. */
export const CATEGORY_ORDER: RequestCategory[] = [
  RequestCategory.IT,
  RequestCategory.HR,
  RequestCategory.FACILITIES,
  RequestCategory.OTHER,
]

/** Display order for tabs and dashboard columns — the order work moves through. */
export const STATUS_ORDER: RequestStatus[] = [
  RequestStatus.NEW,
  RequestStatus.IN_PROGRESS,
  RequestStatus.WAITING,
  RequestStatus.RESOLVED,
  RequestStatus.CLOSED,
]

/**
 * Statuses that still need someone's attention. Mirrors OPEN_STATUSES in the
 * backend enum — a queue is what is left to do, not everything ever raised.
 */
export const OPEN_STATUSES: RequestStatus[] = [
  RequestStatus.NEW,
  RequestStatus.IN_PROGRESS,
  RequestStatus.WAITING,
]
