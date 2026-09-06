import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { AssignControl } from '../../components/requests/AssignControl'
import { HistoryTimeline } from '../../components/requests/HistoryTimeline'
import { StatusActions } from '../../components/requests/StatusActions'
import { Alert } from '../../components/ui/Alert'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { PriorityBadge } from '../../components/ui/PriorityBadge'
import { Spinner } from '../../components/ui/Spinner'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useCurrentUser } from '../../hooks/useAuth'
import { useClaimRequest, useRequest, useUpdateStatus } from '../../hooks/useRequests'
import { useUserNames } from '../../hooks/useUserNames'
import { formatDateTime } from '../../lib/time'
import { canClaim } from '../../lib/workflow'
import { UserRole } from '../../types/domain'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  )
}

export function RequestDetailPage() {
  const { id = '' } = useParams()
  const viewer = useCurrentUser()
  const { data: request, isPending, error } = useRequest(id)
  const updateStatus = useUpdateStatus(id)
  const claim = useClaimRequest()

  // Every id the page needs a name for: whoever acted, plus the current owner.
  const names = useUserNames(
    [
      ...(request?.history.map((h) => h.actorId) ?? []),
      ...(request?.assigneeId ? [request.assigneeId] : []),
    ],
    viewer,
  )

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-subtle">
        <Spinner size={20} />
      </div>
    )
  }

  if (error) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <>
        <PageHeader title="Request" />
        <div className="p-4">
          <Alert>
            {notFound
              ? 'That request does not exist, or you do not have access to it.'
              : 'Could not load this request.'}
          </Alert>
          <Link to="/" className="mt-3 inline-block">
            <Button size="sm">Back to my requests</Button>
          </Link>
        </div>
      </>
    )
  }

  const assigneeName = request.assigneeId ? names.get(request.assigneeId) : null

  return (
    <>
      <PageHeader
        title={request.reference}
        subtitle={request.title}
        actions={<StatusBadge status={request.status} />}
      />

      <div className="flex-1 overflow-auto bg-canvas">
        <div className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{request.title}</CardTitle>
              </CardHeader>
              <p className="whitespace-pre-wrap px-4 py-3 text-sm text-ink">
                {request.description}
              </p>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
                <span className="text-xs text-ink-subtle">{request.history.length} events</span>
              </CardHeader>
              <HistoryTimeline history={request.history} names={names} />
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <div className="space-y-3 px-4 py-3">
                {canClaim(request, viewer) ? (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={claim.isPending}
                    onClick={() => claim.mutate(request.id)}
                  >
                    Claim this request
                  </Button>
                ) : null}
                <StatusActions
                  request={request}
                  viewer={viewer}
                  pending={updateStatus.isPending}
                  error={updateStatus.error}
                  onMove={(status, note) => updateStatus.mutate({ status, note })}
                />
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <dl className="divide-y divide-line">
                <Field label="Status">
                  <StatusBadge status={request.status} />
                </Field>
                <Field label="Priority">
                  <PriorityBadge priority={request.priority} />
                </Field>
                <Field label="Category">
                  <Badge>{request.category}</Badge>
                </Field>
                {viewer.role === UserRole.MANAGER ? (
                  <div className="px-4 py-2">
                    <p className="mb-1.5 text-sm text-ink-muted">Assigned to</p>
                    <AssignControl request={request} />
                  </div>
                ) : (
                <Field label="Assigned to">
                  {assigneeName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={assigneeName} />
                      {assigneeName}
                    </span>
                  ) : request.assigneeId ? (
                    <span className="text-ink-muted">Assigned</span>
                  ) : (
                    <span className="text-ink-subtle">Unclaimed</span>
                  )}
                </Field>
                )}
                <Field label="Submitted">{formatDateTime(request.createdAt)}</Field>
                {request.resolvedAt ? (
                  <Field label="Resolved">{formatDateTime(request.resolvedAt)}</Field>
                ) : null}
                {request.closedAt ? (
                  <Field label="Closed">{formatDateTime(request.closedAt)}</Field>
                ) : null}
              </dl>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
