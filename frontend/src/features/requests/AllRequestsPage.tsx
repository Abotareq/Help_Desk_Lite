import { useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { RequestRow } from '../../components/requests/RequestRow'
import { RequestTable } from '../../components/requests/RequestTable'
import { Alert } from '../../components/ui/Alert'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { useRequestList } from '../../hooks/useRequests'
import { useUsers } from '../../hooks/useUsers'
import { STATUS_ORDER } from '../../lib/status'
import { useI18n } from '../../hooks/useI18n'
import { categoryKey, priorityKey, statusKey } from '../../i18n/keys'
import {
  RequestCategory,
  RequestPriority,
  RequestStatus,
  UserRole,
  type SupportRequest,
} from '../../types/domain'

const PAGE_SIZE = 25

/**
 * The manager's cut across everything. Filters live in the URL rather than in
 * component state, so a view can be linked to — "the unclaimed backlog" is a
 * thing you send someone, not a thing you describe over chat.
 */
export function AllRequestsPage() {
  const { t } = useI18n()

  const [params, setParams] = useSearchParams()
  const { data: users } = useUsers()

  const status = params.get('status') as RequestStatus | null
  const category = params.get('category') as RequestCategory | null
  const priority = params.get('priority') as RequestPriority | null
  const assignee = params.get('assignee')
  const page = Number(params.get('page') ?? '1')

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // Page 3 of the old filter is meaningless under the new one.
    next.delete('page')
    setParams(next, { replace: true })
  }

  const { data, isPending, error } = useRequestList({
    ...(status ? { status: [status] } : {}),
    ...(category ? { category: [category] } : {}),
    ...(priority ? { priority: [priority] } : {}),
    ...(assignee ? { assignee } : {}),
    page,
    limit: PAGE_SIZE,
    sortBy: 'createdAt',
    sortDir: 'desc',
  })

  const names = new Map((users ?? []).map((u) => [u.id, u.name]))
  const handlers = (users ?? []).filter((u) => u.role === UserRole.AGENT)
  const activeFilters = ['status', 'category', 'priority', 'assignee'].filter((k) => params.get(k))
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <>
      <PageHeader
        title={t('allRequests.title')}
        subtitle={data ? t('allRequests.matching', { count: data.total }) : undefined}
        actions={
          activeFilters.length > 0 ? (
            <Button size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              {t('allRequests.clearFilters')}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas px-4 py-2">
        <Select
          aria-label={t('filters.status')}
          className="h-7 w-auto min-w-32"
          value={status ?? ''}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">{t('filters.anyStatus')}</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {t(statusKey(s))}
            </option>
          ))}
        </Select>

        <Select
          aria-label={t('filters.owner')}
          className="h-7 w-auto min-w-32"
          value={assignee ?? ''}
          onChange={(e) => setFilter('assignee', e.target.value)}
        >
          <option value="">{t('filters.anyOwner')}</option>
          <option value="unassigned">{t('detail.unclaimed')}</option>
          {handlers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label={t('filters.category')}
          className="h-7 w-auto min-w-32"
          value={category ?? ''}
          onChange={(e) => setFilter('category', e.target.value)}
        >
          <option value="">{t('filters.anyCategory')}</option>
          {Object.values(RequestCategory).map((c) => (
            <option key={c} value={c}>
              {t(categoryKey(c))}
            </option>
          ))}
        </Select>

        <Select
          aria-label={t('filters.priority')}
          className="h-7 w-auto min-w-32"
          value={priority ?? ''}
          onChange={(e) => setFilter('priority', e.target.value)}
        >
          <option value="">{t('filters.anyPriority')}</option>
          {Object.values(RequestPriority).map((p) => (
            <option key={p} value={p}>
              {t(priorityKey(p))}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {isPending ? (
          <div className="flex justify-center py-16 text-ink-subtle">
            <Spinner size={20} />
          </div>
        ) : error ? (
          <div className="p-4">
            <Alert>
              {error instanceof ApiError ? error.message : t('allRequests.loadFailed')}
            </Alert>
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            title={t('filters.noMatch')}
            description={
              activeFilters.length > 0
                ? t('filters.tryWidening')
                : t('filters.noneRaised')
            }
          />
        ) : (
          <>
            <RequestTable
              trailingHeaders={
                <th scope="col" className="w-36 py-2 pe-4 font-medium">
                  {t('allRequests.owner')}
                </th>
              }
            >
              {data.items.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  trailing={<OwnerCell request={request} names={names} />}
                />
              ))}
            </RequestTable>

            {lastPage > 1 ? (
              <div className="flex items-center justify-between border-t border-line px-4 py-2">
                <span className="text-xs text-ink-subtle">
                  Page {data.page} of {lastPage}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={data.page <= 1}
                    onClick={() => setFilter('page', String(data.page - 1))}
                  >
                    {t('common.previous')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={data.page >= lastPage}
                    onClick={() => setFilter('page', String(data.page + 1))}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}

function OwnerCell({ request, names }: { request: SupportRequest; names: Map<string, string> }) {
  const { t } = useI18n()
  const name = request.assigneeId ? names.get(request.assigneeId) : null

  return (
    <td className="whitespace-nowrap py-2 pe-4 align-middle">
      {name ? (
        <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
          <Avatar name={name} />
          <span className="max-w-24 truncate">{name}</span>
        </span>
      ) : (
        <span className="text-sm text-status-waiting">{t('detail.unclaimed')}</span>
      )}
    </td>
  )
}
