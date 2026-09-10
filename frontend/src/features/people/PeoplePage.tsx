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
import { ResetPasswordDialog } from './ResetPasswordDialog'
import { useI18n } from '../../hooks/useI18n'

export function PeoplePage() {
  const { t } = useI18n()

  const viewer = useCurrentUser()
  const { data: users, isPending, error } = useUsers()
  const updateUser = useUpdateUser()
  const [creating, setCreating] = useState(false)
  const [orphaned, setOrphaned] = useState<OrphanedRequest[] | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)

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
        title={t('people.title')}
        subtitle={users ? t('people.count', { count: users.length }) : undefined}
        actions={
          <Button variant="primary" size="sm" onClick={() => setCreating((open) => !open)}>
            {creating ? t('common.cancel') : t('people.addPerson')}
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
                {t('people.orphaned', { count: orphaned.length })}
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
                {t('common.dismiss')}
              </Button>
            </Alert>
          </div>
        ) : null}

        {resetting ? (
          <div className="p-4 pb-0">
            <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
          </div>
        ) : null}

        {updateUser.isError ? (
          <div className="p-4 pb-0">
            <Alert>
              {updateUser.error instanceof ApiError
                ? updateUser.error.message
                : t('people.updateFailed')}
            </Alert>
          </div>
        ) : null}

        {isPending ? (
          <div className="flex justify-center py-16 text-ink-subtle">
            <Spinner size={20} />
          </div>
        ) : error ? (
          <div className="p-4">
            <Alert>{error instanceof ApiError ? error.message : t('people.loadFailed')}</Alert>
          </div>
        ) : users.length === 0 ? (
          <EmptyState title={t('people.noAccounts')} />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse">
            <thead>
              <tr className="border-b border-line text-start text-xs font-medium text-ink-subtle">
                <th scope="col" className="py-2 ps-4 pe-3 font-medium">
                  {t('people.name')}
                </th>
                <th scope="col" className="py-2 pe-3 font-medium">
                  {t('people.email')}
                </th>
                <th scope="col" className="w-32 py-2 pe-3 font-medium">
                  {t('people.role')}
                </th>
                <th scope="col" className="w-24 py-2 pe-3 font-medium">
                  {t('people.status')}
                </th>
                <th scope="col" className="w-56 py-2 pe-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="py-2 ps-4 pe-3">
                    <span className="inline-flex items-center gap-2 text-sm text-ink">
                      <Avatar name={user.name} />
                      {user.name}
                      {user.id === viewer.id ? (
                        <span className="text-xs text-ink-subtle">{t('common.youMarker')}</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-2 pe-3 text-sm text-ink-muted">{user.email}</td>
                  <td className="py-2 pe-3">
                    <Select
                      aria-label={t('people.roleFor', { name: user.name })}
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
                  <td className="py-2 pe-3">
                    {user.isActive ? (
                      <Badge>{t('people.active')}</Badge>
                    ) : (
                      <Badge className="text-priority-high">{t('people.deactivated')}</Badge>
                    )}
                  </td>
                  <td className="py-2 pe-4 text-end">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={updateUser.isPending}
                        onClick={() => setResetting(user)}
                      >
                        {t('people.resetPassword')}
                      </Button>
                    {canDeactivate(user) ? (
                      <Button
                        size="sm"
                        variant={user.isActive ? 'danger' : 'secondary'}
                        disabled={updateUser.isPending}
                        onClick={() => toggleActive(user)}
                      >
                        {user.isActive ? t('people.deactivate') : t('people.reactivate')}
                      </Button>
                    ) : (
                      <span
                        className="text-xs text-ink-subtle"
                        title={
                          user.id === viewer.id
                            ? t('people.cannotDeactivateSelf')
                            : t('people.lastManagerLocked')
                        }
                      >
                        {user.id === viewer.id ? t('people.you') : t('people.lastManager')}
                      </span>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  )
}
