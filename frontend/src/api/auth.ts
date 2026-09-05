import type { User } from '../types/domain'
import { apiFetch } from './client'

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResult {
  token: string
  user: User
}

export function login(input: LoginInput): Promise<LoginResult> {
  return apiFetch<LoginResult>('/auth/login', { method: 'POST', body: input })
}

export function fetchMe(): Promise<User> {
  return apiFetch<{ user: User }>('/users/me').then((r) => r.user)
}
