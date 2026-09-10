import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { AssignControl } from '../../components/requests/AssignControl'
import { CategoryControl } from '../../components/requests/CategoryControl'
import { CommentForm } from '../../components/requests/CommentForm'
import { StatusActions } from '../../components/requests/StatusActions'
import { Timeline } from '../../components/requests/Timeline'
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
import {
  useAddComment,
  useClaimRequest,
  useComments,
  useRequest,
  useUpdateStatus,
} from '../../hooks/useRequests'
import { useUserNames } from '../../hooks/useUserNames'
import { formatDateTime } from '../../lib/time'
import { useI18n } from '../../hooks/useI18n'
import { categoryKey } from '../../i18n/keys'
import { canChangeCategory, canClaim, canComment } from '../../lib/workflow'
import { UserRole } from '../../types/domain'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-end text-ink">{children}</dd>
    </div>
  )
}

export function RequestDetailPage() {
  const { t, locale } = useI18n()
  const { id = '' } = useParams()
  const viewer = useCurrentUser()
  const { data: request, isPending, error } = useRequest(id)
  const { data: comments } = useComments(id)
  const updateStatus = useUpdateStatus(id)
  const addComment = useAddComment(id)
  const claim = useClaimRequest()

  const thread = comments ?? []

  // Every id the page needs a name for: whoever acted, whoever spoke, plus the
  // current owner.
  const names = useUserNames(
    [
      ...(request?.history.map((h) => h.actorId) ?? []),
      ...thread.map((c) => c.authorId),
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
        <PageHeader title={t('detail.request')} />
        <div className="p-4">
          <Alert>
            {notFound ? t('detail.notFound') : t('detail.loadFailed')}
          </Alert>
          <Link to="/" className="mt-3 inline-block">
            <Button size="sm">{t('detail.backToMine')}</Button>
          </Link>
        </div>
      </>
    )
  }

  const assigneeName = request.assigneeId ? names.get(request.assigneeId) : null

  return (
    <>
      <PageHeader
        contentDir="auto"
        title={request.reference}
        subtitle={request.title}
        actions={<StatusBadge status={request.status} />}
      />

      <div className="flex-1 overflow-auto bg-canvas">
        <div className="mx-auto grid max-w-5xl gap-4 p-3 sm:p-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle dir="auto">{request.title}</CardTitle>
              </CardHeader>
              <p dir="auto" className="whitespace-pre-wrap px-4 py-3 text-sm text-ink">
                {request.description}
              </p>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('detail.activity')}</CardTitle>
                <span className="text-xs text-ink-subtle">
                  {t('detail.entries', { count: request.history.length + thread.length })}
                </span>
              </CardHeader>
              <Timeline history={request.history} comments={thread} names={names} />
              {canComment(request, viewer) ? (
                <CommentForm
                  request={request}
                  viewer={viewer}
                  pending={addComment.isPending}
                  error={addComment.error}
                  onPost={(body, isInternal) => addComment.mutate({ body, isInternal })}
                />
              ) : null}
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('detail.actions')}</CardTitle>
              </CardHeader>
              <div className="space-y-3 px-4 py-3">
                {canClaim(request, viewer) ? (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={claim.isPending}
                    onClick={() => claim.mutate(request.id)}
                  >
                    {t('detail.claim')}
                  </Button>
                ) : null}
                <StatusActions
                  request={request}
                  viewer={viewer}
                  pending={updateStatus.isPending}
                  error={updateStatus.error}
                  onMove={(change) => updateStatus.mutate(change)}
                />
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('detail.details')}</CardTitle>
              </CardHeader>
              <dl className="divide-y divide-line">
                <Field label={t('detail.status')}>
                  <StatusBadge status={request.status} />
                </Field>
                <Field label={t('detail.priority')}>
                  <PriorityBadge priority={request.priority} />
                </Field>
                {canChangeCategory(request, viewer) ? (
                  <div className="px-4 py-2">
                    <p className="mb-1.5 text-sm text-ink-muted">{t('detail.category')}</p>
                    <CategoryControl request={request} />
                  </div>
                ) : (
                  <Field label={t('detail.category')}>
                    <Badge>{t(categoryKey(request.category))}</Badge>
                  </Field>
                )}
                {viewer.role === UserRole.MANAGER ? (
                  <div className="px-4 py-2">
                    <p className="mb-1.5 text-sm text-ink-muted">{t('detail.assignedTo')}</p>
                    <AssignControl request={request} />
                  </div>
                ) : (
                <Field label={t('detail.assignedTo')}>
                  {assigneeName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={assigneeName} />
                      {assigneeName}
                    </span>
                  ) : request.assigneeId ? (
                    <span className="text-ink-muted">{t('detail.assigned')}</span>
                  ) : (
                    <span className="text-ink-subtle">{t('detail.unclaimed')}</span>
                  )}
                </Field>
                )}
                <Field label={t('detail.submitted')}>
                  {formatDateTime(request.createdAt, locale)}
                </Field>
                {request.resolvedAt ? (
                  <Field label={t('detail.resolved')}>
                    {formatDateTime(request.resolvedAt, locale)}
                  </Field>
                ) : null}
                {request.closedAt ? (
                  <Field label={t('detail.closed')}>
                    {formatDateTime(request.closedAt, locale)}
                  </Field>
                ) : null}
              </dl>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
