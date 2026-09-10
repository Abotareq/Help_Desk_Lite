import { Link } from 'react-router-dom'
import { RequestRow } from '../../components/requests/RequestRow'
import { RequestTable } from '../../components/requests/RequestTable'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { useCurrentUser } from '../../hooks/useAuth'
import { useRequestList } from '../../hooks/useRequests'
import { ApiError } from '../../api/client'
import { useI18n } from '../../hooks/useI18n'

export function MyRequestsPage() {
  const { t } = useI18n()

  const user = useCurrentUser()

  // Scoped by requester rather than trusting the API's own scoping, so an agent
  // or manager sees what *they* raised here, not the whole queue.
  const { data, isPending, error } = useRequestList({
    requester: user.id,
    sortBy: 'createdAt',
    sortDir: 'desc',
    limit: 50,
  })

  return (
    <>
      <PageHeader
        title={t('myRequests.title')}
        subtitle={data ? t('requests.total', { count: data.total }) : undefined}
        actions={
          <Link to="/requests/new">
            <Button variant="primary" size="sm">
              {t('requests.newRequest')}
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-auto">
        {isPending ? (
          <div className="flex justify-center py-16 text-ink-subtle">
            <Spinner size={20} />
          </div>
        ) : error ? (
          <div className="p-4">
            <Alert>
              {error instanceof ApiError ? error.message : t('myRequests.loadFailed')}
            </Alert>
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            title={t('myRequests.empty')}
            description={t('myRequests.emptyHint')}
            action={
              <Link to="/requests/new">
                <Button variant="primary" size="sm">
                  {t('myRequests.submitFirst')}
                </Button>
              </Link>
            }
          />
        ) : (
          <RequestTable>
            {data.items.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </RequestTable>
        )}
      </div>
    </>
  )
}
