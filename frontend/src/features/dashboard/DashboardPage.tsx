import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { Alert } from '../../components/ui/Alert'
import { Avatar } from '../../components/ui/Avatar'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useCurrentUser } from '../../hooks/useAuth'
import { useStats } from '../../hooks/useStats'
import { useUsers } from '../../hooks/useUsers'
import { STATUS_ORDER } from '../../lib/status'
import { cn } from '../../lib/cn'
import type { RequestStatus } from '../../types/domain'

interface StatTileProps {
  label: string
  value: number
  hint?: string
  to?: string
  emphasis?: boolean
}

/** One number and what it means. The PRD asks for counts, not a reporting module. */
function StatTile({ label, value, hint, to, emphasis }: StatTileProps) {
  const body = (
    <div
      className={cn(
        'rounded-lg border bg-surface px-4 py-3 transition-colors',
        to && 'hover:border-line-strong',
        emphasis && value > 0 ? 'border-status-waiting/40' : 'border-line',
      )}
    >
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  )

  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}

export function DashboardPage() {
  const viewer = useCurrentUser()
  const { data: stats, isPending, error } = useStats()
  const { data: users } = useUsers()

  const names = new Map((users ?? []).map((u) => [u.id, u.name]))

  if (isPending) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="flex flex-1 items-center justify-center text-ink-subtle">
          <Spinner size={20} />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="p-4">
          <Alert>
            {error instanceof ApiError ? error.message : 'Could not load the dashboard.'}
          </Alert>
        </div>
      </>
    )
  }

  const busiest = [...stats.byAssignee].sort((a, b) => b.count - a.count)

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Where the work is right now" />

      <div className="flex-1 overflow-auto bg-canvas p-4">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Open" value={stats.open} hint="Still needs someone" to="/all" />
            <StatTile
              label="Unclaimed"
              value={stats.unassigned}
              hint="Nobody has picked these up"
              to="/all?assignee=unassigned"
              emphasis
            />
            <StatTile label="Total" value={stats.total} hint="Everything ever raised" to="/all" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By status</CardTitle>
            </CardHeader>
            <ul className="divide-y divide-line">
              {/*
                Every status, including the zeroes — the API returns them all, and
                columns that appear and disappear as work moves are worse than
                useless for spotting a change.
              */}
              {STATUS_ORDER.map((status: RequestStatus) => (
                <li key={status} className="flex items-center justify-between px-4 py-2">
                  <Link to={`/all?status=${status}`} className="hover:underline">
                    <StatusBadge status={status} />
                  </Link>
                  <span className="text-sm tabular-nums text-ink">{stats.byStatus[status]}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workload by owner</CardTitle>
              <span className="text-xs text-ink-subtle">Who is carrying what</span>
            </CardHeader>
            {busiest.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-subtle">Nothing has been raised yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {busiest.map((row) => {
                  const name = row.assigneeId ? names.get(row.assigneeId) : null

                  return (
                    <li
                      key={row.assigneeId ?? 'unassigned'}
                      className="flex items-center justify-between px-4 py-2"
                    >
                      {row.assigneeId ? (
                        <span className="inline-flex items-center gap-2 text-sm text-ink">
                          <Avatar name={name ?? 'Unknown'} />
                          {name ?? 'Unknown user'}
                          {row.assigneeId === viewer.id ? (
                            <span className="text-xs text-ink-subtle">(you)</span>
                          ) : null}
                        </span>
                      ) : (
                        <Link
                          to="/all?assignee=unassigned"
                          className="text-sm text-status-waiting hover:underline"
                        >
                          Unclaimed
                        </Link>
                      )}
                      <span className="text-sm tabular-nums text-ink">{row.count}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
