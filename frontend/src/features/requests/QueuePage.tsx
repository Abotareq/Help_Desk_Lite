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

type QueueTab = 'mine' | 'unclaimed'

/**
 * The support/ops view — the Frappe agent list, scaled to what v1 has.
 *
 * Two tabs rather than a filter bar: "what am I working on" and "what is nobody
 * working on" are the only two questions a handler actually opens this for.
 */
export function QueuePage() {
  const viewer = useCurrentUser()
  const [tab, setTab] = useState<QueueTab>('mine')
  const claim = useClaimRequest()

  // Closed work is excluded from both tabs: a queue is what still needs doing.
  const mine = useRequestList({
    assignee: viewer.id,
    status: [...OPEN_STATUSES],
    sortBy: 'priority',
    sortDir: 'desc',
    limit: 50,
  })

  const unclaimed = useRequestList({
    assignee: 'unassigned',
    status: [...OPEN_STATUSES],
    sortBy: 'priority',
    sortDir: 'desc',
    limit: 50,
  })

  const active = tab === 'mine' ? mine : unclaimed

  const tabs: TabDefinition<QueueTab>[] = [
    { id: 'mine', label: 'My work', count: mine.data?.total },
    { id: 'unclaimed', label: 'Unclaimed', count: unclaimed.data?.total },
  ]

  const names = useUserNames(
    (active.data?.items ?? []).flatMap((r) => (r.requesterId ? [r.requesterId] : [])),
    viewer,
  )

  return (
    <>
      <PageHeader
        title="Queue"
        subtitle="Highest priority first"
        actions={<Tabs tabs={tabs} active={tab} onChange={setTab} />}
      />

      <div className="flex-1 overflow-auto">
        {claim.isError ? (
          <div className="p-4 pb-0">
            <Alert>
              {claim.error instanceof ApiError ? claim.error.message : 'Could not claim that request.'}
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
              {active.error instanceof ApiError ? active.error.message : 'Could not load the queue.'}
            </Alert>
          </div>
        ) : active.data.items.length === 0 ? (
          <EmptyState
            title={tab === 'mine' ? 'Nothing assigned to you' : 'Nothing waiting to be picked up'}
            description={
              tab === 'mine'
                ? 'Claim something from the unclaimed tab to start working it.'
                : 'Every open request already has an owner. That is the queue doing its job.'
            }
            action={
              tab === 'mine' ? (
                <Button size="sm" onClick={() => setTab('unclaimed')}>
                  See unclaimed
                </Button>
              ) : undefined
            }
          />
        ) : (
          <RequestTable
            trailingHeaders={
              <>
                <th scope="col" className="w-36 py-2 pr-3 font-medium">
                  Requester
                </th>
                <th scope="col" className="w-24 py-2 pr-4 font-medium" />
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
  return (
    <>
      <td className="whitespace-nowrap py-2 pr-3 align-middle">
        {requesterName ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <Avatar name={requesterName} />
            <span className="max-w-24 truncate">{requesterName}</span>
          </span>
        ) : (
          <span className="text-sm text-ink-subtle">—</span>
        )}
      </td>
      <td className="whitespace-nowrap py-2 pr-4 text-right align-middle">
        {claimable ? (
          <Button size="sm" loading={claiming} onClick={onClaim}>
            Claim
          </Button>
        ) : null}
      </td>
    </>
  )
}
