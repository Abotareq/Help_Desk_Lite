import { cn } from '../../lib/cn'
import { STATUS_STYLES } from '../../lib/status'
import type { RequestStatus } from '../../types/domain'

/**
 * Status is the most-read thing on every screen, so it gets one definition —
 * a coloured dot plus a label, as Frappe does it — rather than being restyled
 * per view.
 */
export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const style = STATUS_STYLES[status]

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-ink', className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', style.dot)} aria-hidden="true" />
      {style.label}
    </span>
  )
}
