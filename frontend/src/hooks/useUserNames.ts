import { useQueries, useQuery } from '@tanstack/react-query'
import { fetchUser, listUsers } from '../api/users'
import { UserRole, type User } from '../types/domain'

/**
 * Resolves user ids to names for whoever is looking.
 *
 * Staff can list everyone in one call. An employee cannot — listing is
 * staff-only — so their handful of ids are fetched individually. Without this
 * a requester could not see who is working their request, which the PRD asks
 * for explicitly.
 */
export function useUserNames(ids: string[], viewer: User): Map<string, string> {
  const canList = viewer.role !== UserRole.EMPLOYEE

  const list = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => listUsers(),
    enabled: canList,
  })

  const unknown = [...new Set(ids)].filter((id) => id && id !== viewer.id)

  const individually = useQueries({
    queries: canList
      ? []
      : unknown.map((id) => ({
          queryKey: ['users', 'detail', id],
          queryFn: () => fetchUser(id),
          // Names change far less often than tickets do.
          staleTime: 5 * 60_000,
        })),
  })

  const names = new Map<string, string>([[viewer.id, viewer.name]])
  for (const user of list.data ?? []) names.set(user.id, user.name)
  for (const result of individually) {
    if (result.data) names.set(result.data.id, result.data.name)
  }

  return names
}
