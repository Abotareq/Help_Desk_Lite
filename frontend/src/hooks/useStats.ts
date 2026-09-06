import { useQuery } from '@tanstack/react-query'
import { fetchStats, type RequestFilters } from '../api/requests'
import { requestKeys } from './useRequests'

export function useStats(filters: RequestFilters = {}) {
  return useQuery({
    queryKey: [...requestKeys.stats(), filters],
    queryFn: () => fetchStats(filters),
  })
}
