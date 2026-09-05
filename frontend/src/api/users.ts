import type { OrphanedRequest, User, UserRole } from '../types/domain'
import { apiFetch } from './client'

export function listUsers(filter: { role?: UserRole; isActive?: boolean } = {}): Promise<User[]> {
  return apiFetch<{ users: User[]; total: number }>('/users', {
    query: {
      role: filter.role,
      isActive: filter.isActive === undefined ? undefined : String(filter.isActive),
    },
  }).then((r) => r.users)
}

export interface CreateUserInput {
  email: string
  name: string
  role: UserRole
  password: string
}

export function createUser(input: CreateUserInput): Promise<User> {
  return apiFetch<{ user: User }>('/users', { method: 'POST', body: input }).then((r) => r.user)
}

export interface UpdateUserInput {
  name?: string
  role?: UserRole
  isActive?: boolean
}

export interface UpdateUserResult {
  user: User
  orphanedRequests: OrphanedRequest[]
}

export function updateUser(id: string, input: UpdateUserInput): Promise<UpdateUserResult> {
  return apiFetch<UpdateUserResult>(`/users/${id}`, { method: 'PATCH', body: input })
}

export function resetPassword(id: string, password: string): Promise<User> {
  return apiFetch<{ user: User }>(`/users/${id}/password`, {
    method: 'POST',
    body: { password },
  }).then((r) => r.user)
}
