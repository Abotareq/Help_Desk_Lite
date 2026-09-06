import { useMutation, useQueryClient } from '@tanstack/react-query'
import { assignRequest } from '../../api/requests'
import { ApiError } from '../../api/client'
import { requestKeys } from '../../hooks/useRequests'
import { useUsers } from '../../hooks/useUsers'
import { UserRole, type SupportRequest } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Select } from '../ui/Select'

/**
 * Manager-only. Assign, reassign, or hand a request back to the queue — the
 * three things the API's assign endpoint does, in one control.
 */
export function AssignControl({ request }: { request: SupportRequest }) {
  const queryClient = useQueryClient()
  const { data: users } = useUsers()

  const assign = useMutation({
    mutationFn: (assigneeId: string | null) => assignRequest(request.id, assigneeId),
    onSuccess: (updated) => {
      queryClient.setQueryData(requestKeys.detail(request.id), updated)
      void queryClient.invalidateQueries({ queryKey: requestKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: requestKeys.stats() })
    },
  })

  // Only staff can own work — the API refuses an employee, so offering one
  // would be setting the manager up for a 422.
  const handlers = (users ?? []).filter((u) => u.role !== UserRole.EMPLOYEE && u.isActive)

  return (
    <div className="space-y-2">
      <Select
        aria-label="Assign to"
        value={request.assigneeId ?? ''}
        disabled={assign.isPending}
        onChange={(e) => assign.mutate(e.target.value || null)}
      >
        <option value="">Unclaimed</option>
        {handlers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>

      {assign.isError ? (
        <Alert>
          {assign.error instanceof ApiError ? assign.error.message : 'Could not reassign it.'}
        </Alert>
      ) : null}
    </div>
  )
}
