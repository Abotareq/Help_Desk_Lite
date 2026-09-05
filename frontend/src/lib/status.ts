import { RequestStatus } from '../types/domain'

/**
 * Status presentation lives here rather than beside the component, so the badge
 * file exports only a component — which is what keeps Fast Refresh working, and
 * lets non-visual code ask for a label without importing UI.
 */
export const STATUS_STYLES: Record<RequestStatus, { dot: string; label: string }> = {
  [RequestStatus.NEW]: { dot: 'bg-status-new', label: 'New' },
  [RequestStatus.IN_PROGRESS]: { dot: 'bg-status-progress', label: 'In progress' },
  [RequestStatus.WAITING]: { dot: 'bg-status-waiting', label: 'Waiting' },
  [RequestStatus.RESOLVED]: { dot: 'bg-status-resolved', label: 'Resolved' },
  [RequestStatus.CLOSED]: { dot: 'bg-status-closed', label: 'Closed' },
}

export function statusLabel(status: RequestStatus): string {
  return STATUS_STYLES[status].label
}

/** Display order for tabs and dashboard columns — the order work moves through. */
export const STATUS_ORDER: RequestStatus[] = [
  RequestStatus.NEW,
  RequestStatus.IN_PROGRESS,
  RequestStatus.WAITING,
  RequestStatus.RESOLVED,
  RequestStatus.CLOSED,
]
