import type {
  Paginated,
  RequestCategory,
  RequestHistoryEntry,
  RequestPriority,
  RequestStats,
  RequestStatus,
  SupportRequest,
} from '../types/domain'
import { apiFetch } from './client'

export interface CreateRequestInput {
  title: string
  description: string
  category: RequestCategory
  priority?: RequestPriority
}

export function createRequest(input: CreateRequestInput): Promise<SupportRequest> {
  return apiFetch<{ request: SupportRequest }>('/requests', {
    method: 'POST',
    body: input,
  }).then((r) => r.request)
}

export function fetchRequest(id: string): Promise<SupportRequest> {
  return apiFetch<{ request: SupportRequest }>(`/requests/${id}`).then((r) => r.request)
}

export function fetchHistory(id: string): Promise<RequestHistoryEntry[]> {
  return apiFetch<{ history: RequestHistoryEntry[]; total: number }>(`/requests/${id}/history`).then(
    (r) => r.history,
  )
}

export interface RequestFilters {
  status?: RequestStatus[]
  category?: RequestCategory[]
  priority?: RequestPriority[]
  /** A user id, or the literal 'unassigned' for the unclaimed queue. */
  assignee?: string
  requester?: string
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status'
  sortDir?: 'asc' | 'desc'
}

export function listRequests(filters: RequestFilters = {}): Promise<Paginated<SupportRequest>> {
  return apiFetch<Paginated<SupportRequest>>('/requests', { query: { ...filters } })
}

export function listMyQueue(
  options: { page?: number; limit?: number } = {},
): Promise<Paginated<SupportRequest>> {
  return apiFetch<Paginated<SupportRequest>>('/requests/mine', { query: { ...options } })
}

export function fetchStats(filters: RequestFilters = {}): Promise<RequestStats> {
  return apiFetch<RequestStats>('/requests/stats', { query: { ...filters } })
}

export function claimRequest(id: string): Promise<SupportRequest> {
  return apiFetch<{ request: SupportRequest }>(`/requests/${id}/claim`, { method: 'POST' }).then(
    (r) => r.request,
  )
}

export function assignRequest(id: string, assigneeId: string | null): Promise<SupportRequest> {
  return apiFetch<{ request: SupportRequest }>(`/requests/${id}/assign`, {
    method: 'PATCH',
    body: { assigneeId },
  }).then((r) => r.request)
}

export function updateStatus(
  id: string,
  status: RequestStatus,
  note?: string,
): Promise<SupportRequest> {
  return apiFetch<{ request: SupportRequest }>(`/requests/${id}/status`, {
    method: 'PATCH',
    body: note ? { status, note } : { status },
  }).then((r) => r.request)
}
