import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { Alert } from '../../components/ui/Alert'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { useCurrentUser } from '../../hooks/useAuth'
import { useUpdateUser, useUsers } from '../../hooks/useUsers'
import { UserRole, type OrphanedRequest, type User } from '../../types/domain'
import { NewUserForm } from './NewUserForm'

export function PeoplePage() {
  const viewer = useCurrentUser()
  const { data: users, isPending, error } = useUsers()
  const updateUser = useUpdateUser()
  const [creating, setCreating] = useState(false)
  const [orphaned, setOrphaned] = useState<OrphanedRequest[] | null>(null)

  const activeManagers = (users ?? []).filter(
    (u) => u.role === UserRole.MANAGER && u.isActive,
  ).length

  /**
   * Mirrors the API's lockout guards, so a blocked action is simply absent
   * rather than offered and then refused.
   *
   * In practice only the self check fires: the viewer is an active manager, so
   * any *other* active manager makes two, and the count can never be one. The
   * count check is a backstop for the stale case — a session whose own account
   * was deactivated elsewhere but whose token is still valid. The API is the
   * real guard either way, and it is tested there.
   */
  function canDeactivate(user: User): boolean {
    if (!user.isActive) return true
    if (user.id === viewer.id) return false
    if (user.role === UserRole.MANAGER && activeManagers <= 1) return false
    return true
  }

  function toggleActive(user: User) {
    updateUser.mutate(
      { id: user.id, changes: { isActive: !user.isActive } },
      {
        onSuccess: (result) => {
          setOrphaned(result.orphanedRequests.length > 0 ? result.orphanedRequests : null)
        },
      },
    )
  }

  return (
    <>
      <PageHeader
        title="People"
        subtitle={users ? `${users.length} accounts` : undefined}
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating((open) => !open)}>
            {creating ? 'Cancel' : 'Add person'}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        {creating ? (
          <div className="border-b border-line bg-canvas p-4">
            <NewUserForm onDone={() => setCreating(false)} />
          </div>
        ) : null}

        {/*
          The API reports the open work a deactivation strands. Surfacing it at
          that moment is the whole point — otherwise it is discovered when a
          requester chases an untouched ticket weeks later.
        */}
        {orphaned ? (
          <div className="p-4 pb-0">
            <Alert tone="warning">
              <p className="font-medium">
                {orphaned.length} open {orphaned.length === 1 ? 'request needs' : 'requests need'} a
                new owner
              </p>
              <ul className="mt-1 space-y-0.5">
                {orphaned.map((r) => (
                  <li key={r.id}>
                    <Link to={`/requests/${r.id}`} className="font-mono text-xs underline">
                      {r.reference}
                    </Link>
                  </li>
                ))}
              </ul>
              <Button size="sm" className="mt-2" onClick={() => setOrphaned(null)}>
                Dismiss
              </Button>
            </Alert>
          </div>
        ) : null}

        {updateUser.isError ? (
          <div className="p-4 pb-0">
            <Alert>
              {updateUser.error instanceof ApiError
                ? updateUser.error.message
                : 'Could not update that account.'}
            </Alert>
          </div>
        ) : null}

        {isPending ? (
          <div className="flex justify-center py-16 text-ink-subtle">
            <Spinner size={20} />
          </div>
        ) : error ? (
          <div className="p-4">
            <Alert>{error instanceof ApiError ? error.message : 'Could not load people.'}</Alert>
          </div>
        ) : users.length === 0 ? (
          <EmptyState title="No accounts yet" />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-ink-subtle">
                <th scope="col" className="py-2 pl-4 pr-3 font-medium">
                  Name
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Email
                </th>
                <th scope="col" className="w-32 py-2 pr-3 font-medium">
                  Role
                </th>
                <th scope="col" className="w-24 py-2 pr-3 font-medium">
                  Status
                </th>
                <th scope="col" className="w-32 py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="py-2 pl-4 pr-3">
                    <span className="inline-flex items-center gap-2 text-sm text-ink">
                      <Avatar name={user.name} />
                      {user.name}
                      {user.id === viewer.id ? (
                        <span className="text-xs text-ink-subtle">(you)</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-sm text-ink-muted">{user.email}</td>
                  <td className="py-2 pr-3">
                    <Select
                      aria-label={`Role for ${user.name}`}
                      className="h-7"
                      value={user.role}
                      disabled={updateUser.isPending}
                      onChange={(e) =>
                        updateUser.mutate({
                          id: user.id,
                          changes: { role: e.target.value as UserRole },
                        })
                      }
                    >
                      {Object.values(UserRole).map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="py-2 pr-3">
                    {user.isActive ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge className="text-priority-high">Deactivated</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {canDeactivate(user) ? (
                      <Button
                        size="sm"
                        variant={user.isActive ? 'danger' : 'secondary'}
                        disabled={updateUser.isPending}
                        onClick={() => toggleActive(user)}
                      >
                        {user.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    ) : (
                      <span
                        className="text-xs text-ink-subtle"
                        title={
                          user.id === viewer.id
                            ? 'You cannot deactivate your own account'
                            : 'The last active manager cannot be deactivated'
                        }
                      >
                        {user.id === viewer.id ? 'You' : 'Last manager'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
