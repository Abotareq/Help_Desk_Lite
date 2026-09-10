import { useState } from 'react'
import { ApiError } from '../../api/client'
import { RequestRow } from '../../components/requests/RequestRow'
import { RequestTable } from '../../components/requests/RequestTable'
import { Alert } from '../../components/ui/Alert'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { Tabs, type TabDefinition } from '../../components/ui/Tabs'
import { useCurrentUser } from '../../hooks/useAuth'
import { useClaimRequest, useRequestList } from '../../hooks/useRequests'
import { useUserNames } from '../../hooks/useUserNames'
import { OPEN_STATUSES } from '../../lib/status'
import { canClaim } from '../../lib/workflow'
import type { SupportRequest } from '../../types/domain'
import { useI18n } from '../../hooks/useI18n'

type QueueTab = 'mine' | 'unclaimed'

/**
 * The support/ops view — the Frappe agent list, scaled to what v1 has.
 *
 * Two tabs rather than a filter bar: "what am I working on" and "what is nobody
 * working on" are the only two questions a handler actually opens this for.
 */
export function QueuePage() {
  const { t } = useI18n()

  const viewer = useCurrentUser()
  const [tab, setTab] = useState<QueueTab>('mine')
  const claim = useClaimRequest()

  // Everything the agent owns, whatever state it is in. Work they resolved
  // still belongs to them — it can be reopened, and it is the record of what
  // they have done. Dropping it the moment it is fixed makes the screen lie.
  const mine = useRequestList({
    assignee: viewer.id,
    sortBy: 'priority',
    sortDir: 'desc',
    limit: 50,
  })

  // The unclaimed pool stays open-only: a closed request nobody owns is not
  // waiting to be picked up.
  const unclaimed = useRequestList({
    assignee: 'unassigned',
    status: [...OPEN_STATUSES],
    sortBy: 'priority',
    sortDir: 'desc',
    limit: 50,
  })

  const active = tab === 'mine' ? mine : unclaimed

  const tabs: TabDefinition<QueueTab>[] = [
    { id: 'mine', label: t('queue.myWork'), count: mine.data?.total },
    { id: 'unclaimed', label: t('detail.unclaimed'), count: unclaimed.data?.total },
  ]

  const names = useUserNames(
    (active.data?.items ?? []).flatMap((r) => (r.requesterId ? [r.requesterId] : [])),
    viewer,
  )

  return (
    <>
      <PageHeader
        title={t('queue.title')}
        subtitle={t('queue.subtitle')}
        actions={<Tabs tabs={tabs} active={tab} onChange={setTab} />}
      />

      <div className="flex-1 overflow-auto">
        {claim.isError ? (
          <div className="p-4 pb-0">
            <Alert>
              {claim.error instanceof ApiError ? claim.error.message : t('queue.claimFailed')}
            </Alert>
          </div>
        ) : null}

        {active.isPending ? (
          <div className="flex justify-center py-16 text-ink-subtle">
            <Spinner size={20} />
          </div>
        ) : active.error ? (
          <div className="p-4">
            <Alert>
              {active.error instanceof ApiError ? active.error.message : t('queue.loadFailed')}
            </Alert>
          </div>
        ) : active.data.items.length === 0 ? (
          <EmptyState
            title={tab === 'mine' ? t('queue.emptyMine') : t('queue.emptyUnclaimed')}
            description={
              tab === 'mine'
                ? t('queue.claimFromUnclaimed')
                : t('queue.allOwned')
            }
            action={
              tab === 'mine' ? (
                <Button size="sm" onClick={() => setTab('unclaimed')}>
                  {t('queue.seeUnclaimed')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <RequestTable
            trailingHeaders={
              <>
                <th scope="col" className="w-36 py-2 pe-3 font-medium">
                  {t('requests.colRequester')}
                </th>
                <th scope="col" className="w-24 py-2 pe-4 font-medium" />
              </>
            }
          >
            {active.data.items.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                trailing={
                  <QueueRowActions
                    request={request}
                    requesterName={names.get(request.requesterId)}
                    claimable={canClaim(request, viewer)}
                    claiming={claim.isPending && claim.variables === request.id}
                    onClaim={() => claim.mutate(request.id)}
                  />
                }
              />
            ))}
          </RequestTable>
        )}
      </div>
    </>
  )
}

interface QueueRowActionsProps {
  request: SupportRequest
  requesterName: string | undefined
  claimable: boolean
  claiming: boolean
  onClaim: () => void
}

/** Requester and the claim control, so work can be picked up without opening it. */
function QueueRowActions({ requesterName, claimable, claiming, onClaim }: QueueRowActionsProps) {
  const { t } = useI18n()

  return (
    <>
      <td className="whitespace-nowrap py-2 pe-3 align-middle">
        {requesterName ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <Avatar name={requesterName} />
            <span className="max-w-24 truncate">{requesterName}</span>
          </span>
        ) : (
          <span className="text-sm text-ink-subtle">—</span>
        )}
      </td>
      <td className="whitespace-nowrap py-2 pe-4 text-end align-middle">
        {claimable ? (
          <Button size="sm" loading={claiming} onClick={onClaim}>
            {t('queue.claim')}
          </Button>
        ) : null}
      </td>
    </>
  )
}
