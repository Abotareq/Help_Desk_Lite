import { statusLabel } from '../../lib/status'
import { formatDateTime, timeAgo } from '../../lib/time'
import type { HistoryEventType, RequestHistoryEntry } from '../../types/domain'
import { Avatar } from '../ui/Avatar'

/**
 * The PRD asks for a basic history of status changes. Rendering it as a
 * timeline rather than a table is what makes "where did this get stuck" legible
 * at a glance.
 */
const DOT_COLOUR: Record<HistoryEventType, string> = {
  CREATED: 'bg-status-new',
  ASSIGNED: 'bg-status-progress',
  UNASSIGNED: 'bg-status-closed',
  STATUS_CHANGED: 'bg-ink-subtle',
  REOPENED: 'bg-status-waiting',
}

function describe(entry: RequestHistoryEntry, actorName: string): string {
  switch (entry.type) {
    case 'CREATED':
      return `${actorName} submitted this request`
    case 'ASSIGNED':
      return `${actorName} assigned it`
    case 'UNASSIGNED':
      return `${actorName} returned it to the queue`
    case 'REOPENED':
      return `${actorName} reopened it`
    case 'STATUS_CHANGED':
      return entry.fromStatus
        ? `${actorName} moved it from ${statusLabel(entry.fromStatus)} to ${statusLabel(entry.toStatus)}`
        : `${actorName} set it to ${statusLabel(entry.toStatus)}`
    default:
      return `${actorName} updated it`
  }
}

interface HistoryTimelineProps {
  history: RequestHistoryEntry[]
  /** Names by user id, so the trail reads as people rather than object ids. */
  names: Map<string, string>
}

export function HistoryTimeline({ history, names }: HistoryTimelineProps) {
  if (history.length === 0) {
    return <p className="px-4 py-6 text-sm text-ink-subtle">Nothing has happened yet.</p>
  }

  return (
    <ol className="relative px-4 py-3">
      {history.map((entry, index) => {
        const actorName = names.get(entry.actorId) ?? 'Someone'
        const isLast = index === history.length - 1

        return (
          <li key={`${entry.at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span
                className="absolute left-[9px] top-5 h-full w-px bg-line"
                aria-hidden="true"
              />
            ) : null}

            <span className="relative z-10 mt-1.5 flex size-[19px] shrink-0 items-center justify-center">
              <span className={`size-2 rounded-full ${DOT_COLOUR[entry.type]}`} aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Avatar name={actorName} />
                <span className="text-sm text-ink">{describe(entry, actorName)}</span>
                <time
                  dateTime={entry.at}
                  title={formatDateTime(entry.at)}
                  className="text-xs text-ink-subtle"
                >
                  {timeAgo(entry.at)}
                </time>
              </div>
              {entry.note ? (
                <p className="mt-1 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink-muted">
                  {entry.note}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
