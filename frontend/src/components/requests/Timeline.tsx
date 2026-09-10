import { useI18n } from '../../hooks/useI18n'
import { categoryKey, statusKey } from '../../i18n/keys'
import type { I18nContextValue } from '../../i18n/i18nContext'
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
  CATEGORY_CHANGED: 'bg-ink-subtle',
}

/**
 * The whole sentence comes from the catalogue with the actor and the states
 * interpolated, rather than being assembled from fragments here. Word order is
 * not the same in every language, so a sentence stitched together in code can
 * only ever be right in the one it was written for.
 */
function describe(entry: RequestHistoryEntry, actor: string, t: I18nContextValue['t']): string {
  switch (entry.type) {
    case 'CREATED':
      return t('timeline.created', { actor })
    case 'ASSIGNED':
      return t('timeline.assigned', { actor })
    case 'UNASSIGNED':
      return t('timeline.unassigned', { actor })
    case 'REOPENED':
      return t('timeline.reopened', { actor })
    case 'CATEGORY_CHANGED':
      return entry.fromCategory && entry.toCategory
        ? t('timeline.categoryChanged', {
            actor,
            from: t(categoryKey(entry.fromCategory)),
            to: t(categoryKey(entry.toCategory)),
          })
        : t('timeline.categoryChangedPlain', { actor })
    case 'STATUS_CHANGED':
      return entry.fromStatus
        ? t('timeline.statusChanged', {
            actor,
            from: t(statusKey(entry.fromStatus)),
            to: t(statusKey(entry.toStatus)),
          })
        : t('timeline.statusSet', { actor, to: t(statusKey(entry.toStatus)) })
    default:
      return t('timeline.updated', { actor })
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
  const { t, locale } = useI18n()
  const items = merge(history, comments)

  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-ink-subtle">{t('timeline.empty')}</p>
  }

  return (
    <ol className="relative px-4 py-3">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const authorId = item.kind === 'event' ? item.entry.actorId : item.comment.authorId
        const name = names.get(authorId) ?? t('timeline.someone')
        const at = item.kind === 'event' ? item.entry.at : item.comment.at

        return (
          <li key={item.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span className="absolute start-[9px] top-5 h-full w-px bg-line" aria-hidden="true" />
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
                  {item.kind === 'event'
                    ? describe(item.entry, name, t)
                    : t('timeline.commented', { actor: name })}
                </span>
                {item.kind === 'comment' && item.comment.isInternal ? (
                  <Badge className="border-priority-medium/40 text-priority-medium">
                    {t('timeline.internalNote')}
                  </Badge>
                ) : null}
                <time
                  dateTime={at}
                  title={formatDateTime(at, locale)}
                  className="text-xs text-ink-subtle"
                >
                  {timeAgo(at, locale)}
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
