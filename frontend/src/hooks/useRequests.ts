import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  claimRequest,
  createRequest,
  fetchRequest,
  listRequests,
  updateStatus,
  type CreateRequestInput,
  type RequestFilters,
} from '../api/requests'
import type { RequestStatus } from '../types/domain'

/**
 * Query keys in one place so a mutation can invalidate exactly what it changed,
 * rather than every screen guessing at the same string.
 */
export const requestKeys = {
  all: ['requests'] as const,
  lists: () => [...requestKeys.all, 'list'] as const,
  list: (filters: RequestFilters) => [...requestKeys.lists(), filters] as const,
  details: () => [...requestKeys.all, 'detail'] as const,
  detail: (id: string) => [...requestKeys.details(), id] as const,
  stats: () => [...requestKeys.all, 'stats'] as const,
}

export function useRequestList(filters: RequestFilters) {
  return useQuery({
    queryKey: requestKeys.list(filters),
    queryFn: () => listRequests(filters),
  })
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: requestKeys.detail(id),
    queryFn: () => fetchRequest(id),
    enabled: Boolean(id),
  })
}

export function useCreateRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateRequestInput) => createRequest(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.all })
    },
  })
}

export function useUpdateStatus(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ status, note }: { status: RequestStatus; note?: string }) =>
      updateStatus(id, status, note),
    onSuccess: (updated) => {
      // Seed the detail cache from the response so the page updates without a
      // second round trip, then let the lists refetch in the background.
      queryClient.setQueryData(requestKeys.detail(id), updated)
      void queryClient.invalidateQueries({ queryKey: requestKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: requestKeys.stats() })
    },
  })
}

export function useClaimRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => claimRequest(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(requestKeys.detail(updated.id), updated)
      void queryClient.invalidateQueries({ queryKey: requestKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: requestKeys.stats() })
    },
  })
}
