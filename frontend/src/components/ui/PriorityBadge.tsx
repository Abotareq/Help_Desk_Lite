import { RequestPriority } from '../../types/domain'
import { useI18n } from '../../hooks/useI18n'
import { priorityKey } from '../../i18n/keys'
import { cn } from '../../lib/cn'

const PRIORITY_STYLES: Record<RequestPriority, string> = {
  [RequestPriority.HIGH]: 'text-priority-high',
  [RequestPriority.MEDIUM]: 'text-priority-medium',
  [RequestPriority.LOW]: 'text-priority-low',
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: RequestPriority
  className?: string
}) {
  const { t } = useI18n()
  return (
    <span className={cn('text-sm', PRIORITY_STYLES[priority], className)}>
      {t(priorityKey(priority))}
    </span>
  )
}
