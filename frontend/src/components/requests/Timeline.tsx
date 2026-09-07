import { statusLabel } from '../../lib/status'
import { formatDateTime, timeAgo } from '../../lib/time'
import type { HistoryEventType, RequestComment, RequestHistoryEntry } from '../../types/domain'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'

/**
 * One request, told in order: what happened to it and what people said about
 * it, interleaved.
 *
 * They arrive from two endpoints because an internal note must not ride along
 * on a request payload, but they are one story to whoever is reading — and
 * splitting them into a "History" card and a "Comments" card would leave the
 * reader stitching two timestamps columns together in their head to work out
 * whether the answer came before or after the request went on hold.
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

type TimelineItem =
  | { kind: 'event'; at: number; key: string; entry: RequestHistoryEntry }
  | { kind: 'comment'; at: number; key: string; comment: RequestComment }

/**
 * Merged oldest first. Where a status change and its message share a timestamp —
 * they do, when one call carried both — the event sorts first, so the reader
 * sees the move and then what was said about it.
 */
function merge(history: RequestHistoryEntry[], comments: RequestComment[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...history.map((entry, index) => ({
      kind: 'event' as const,
      at: new Date(entry.at).getTime(),
      key: `event-${entry.at}-${index}`,
      entry,
    })),
    ...comments.map((comment) => ({
      kind: 'comment' as const,
      at: new Date(comment.at).getTime(),
      key: `comment-${comment.id}`,
      comment,
    })),
  ]

  return items.sort((a, b) => a.at - b.at || rank(a) - rank(b))
}

function rank(item: TimelineItem): number {
  return item.kind === 'event' ? 0 : 1
}

interface TimelineProps {
  history: RequestHistoryEntry[]
  comments: RequestComment[]
  /** Names by user id, so the trail reads as people rather than object ids. */
  names: Map<string, string>
}

export function Timeline({ history, comments, names }: TimelineProps) {
  const items = merge(history, comments)

  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-ink-subtle">Nothing has happened yet.</p>
  }

  return (
    <ol className="relative px-4 py-3">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const authorId = item.kind === 'event' ? item.entry.actorId : item.comment.authorId
        const name = names.get(authorId) ?? 'Someone'
        const at = item.kind === 'event' ? item.entry.at : item.comment.at

        return (
          <li key={item.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span className="absolute left-[9px] top-5 h-full w-px bg-line" aria-hidden="true" />
            ) : null}

            <span className="relative z-10 mt-1.5 flex size-[19px] shrink-0 items-center justify-center">
              <span
                className={`size-2 rounded-full ${
                  item.kind === 'event'
                    ? DOT_COLOUR[item.entry.type]
                    : item.comment.isInternal
                      ? 'bg-priority-medium'
                      : 'bg-brand'
                }`}
                aria-hidden="true"
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Avatar name={name} />
                <span className="text-sm text-ink">
                  {item.kind === 'event' ? describe(item.entry, name) : `${name} commented`}
                </span>
                {item.kind === 'comment' && item.comment.isInternal ? (
                  <Badge className="border-priority-medium/40 text-priority-medium">
                    Internal note
                  </Badge>
                ) : null}
                <time dateTime={at} title={formatDateTime(at)} className="text-xs text-ink-subtle">
                  {timeAgo(at)}
                </time>
              </div>

              {item.kind === 'event' && item.entry.note ? (
                <p className="mt-1 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink-muted">
                  {item.entry.note}
                </p>
              ) : null}

              {item.kind === 'comment' ? (
                <p
                  className={`mt-1 whitespace-pre-wrap rounded-md border px-2.5 py-1.5 text-sm ${
                    item.comment.isInternal
                      ? 'border-dashed border-priority-medium/40 bg-priority-medium/5 text-ink'
                      : 'border-line bg-surface text-ink'
                  }`}
                >
                  {item.comment.body}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
