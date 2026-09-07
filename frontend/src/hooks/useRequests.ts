import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addComment,
  claimRequest,
  createRequest,
  fetchComments,
  fetchRequest,
  listRequests,
  updateStatus,
  type CreateRequestInput,
  type NewComment,
  type RequestFilters,
  type StatusChange,
} from '../api/requests'

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
  comments: (id: string) => [...requestKeys.detail(id), 'comments'] as const,
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
    mutationFn: (change: StatusChange) => updateStatus(id, change),
    onSuccess: (updated) => {
      // Seed the detail cache from the response so the page updates without a
      // second round trip, then let the lists refetch in the background.
      queryClient.setQueryData(requestKeys.detail(id), updated)
      // The move may have carried a message, and the response does not include
      // the thread — so it is refetched rather than guessed at.
      void queryClient.invalidateQueries({ queryKey: requestKeys.comments(id) })
      void queryClient.invalidateQueries({ queryKey: requestKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: requestKeys.stats() })
    },
  })
}

export function useComments(id: string) {
  return useQuery({
    queryKey: requestKeys.comments(id),
    queryFn: () => fetchComments(id),
    enabled: Boolean(id),
  })
}

export function useAddComment(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (comment: NewComment) => addComment(id, comment),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.comments(id) })
      // A comment moves the request up a "recently active" list, so the lists
      // are no longer current either.
      void queryClient.invalidateQueries({ queryKey: requestKeys.lists() })
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
