/**
 * Mirrors the API contract. Kept hand-written and small rather than generated:
 * the backend's OpenAPI description is still a v2 ticket (KAN-56), and when it
 * lands these can be replaced by generated types without touching call sites.
 */

export const UserRole = {
  EMPLOYEE: 'EMPLOYEE',
  AGENT: 'AGENT',
  MANAGER: 'MANAGER',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const RequestStatus = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING: 'WAITING',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus]

export const RequestCategory = {
  IT: 'IT',
  HR: 'HR',
  FACILITIES: 'FACILITIES',
  OTHER: 'OTHER',
} as const
export type RequestCategory = (typeof RequestCategory)[keyof typeof RequestCategory]

export const RequestPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const
export type RequestPriority = (typeof RequestPriority)[keyof typeof RequestPriority]

export type HistoryEventType =
  | 'CREATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'REOPENED'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface RequestHistoryEntry {
  type: HistoryEventType
  fromStatus: RequestStatus | null
  toStatus: RequestStatus
  actorId: string
  note?: string
  at: string
}

export interface SupportRequest {
  id: string
  reference: string
  title: string
  description: string
  category: RequestCategory
  priority: RequestPriority
  status: RequestStatus
  requesterId: string
  assigneeId: string | null
  history: RequestHistoryEntry[]
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface RequestStats {
  total: number
  open: number
  unassigned: number
  byStatus: Record<RequestStatus, number>
  byAssignee: { assigneeId: string | null; count: number }[]
}

export interface OrphanedRequest {
  id: string
  reference: string
  status: RequestStatus
}
