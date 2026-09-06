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

export function MyRequestsPage() {
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
        title="My requests"
        subtitle={data ? `${data.total} total` : undefined}
        actions={
          <Link to="/requests/new">
            <Button variant="primary" size="sm">
              New request
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
              {error instanceof ApiError ? error.message : 'Could not load your requests.'}
            </Alert>
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            title="You have not submitted anything yet"
            description="When you need help with a laptop, an account, the building or anything else, raise it here so it does not get lost in a chat thread."
            action={
              <Link to="/requests/new">
                <Button variant="primary" size="sm">
                  Submit your first request
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
