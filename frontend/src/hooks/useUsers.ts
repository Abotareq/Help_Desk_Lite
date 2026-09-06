import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createUser,
  listUsers,
  resetPassword,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
} from '../api/users'
import type { UserRole } from '../types/domain'

export const userKeys = {
  all: ['users'] as const,
  list: (filter: { role?: UserRole; isActive?: boolean }) => [...userKeys.all, 'list', filter] as const,
}

export function useUsers(filter: { role?: UserRole; isActive?: boolean } = {}) {
  return useQuery({
    queryKey: userKeys.list(filter),
    queryFn: () => listUsers(filter),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateUserInput }) =>
      updateUser(id, changes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all })
      // A deactivation can strand work, so the queues are no longer accurate.
      void queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetPassword(id, password),
  })
}
