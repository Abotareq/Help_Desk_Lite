import { RequestPriority } from '../../types/domain'
import { cn } from '../../lib/cn'

const PRIORITY_STYLES: Record<RequestPriority, { className: string; label: string }> = {
  [RequestPriority.HIGH]: { className: 'text-priority-high', label: 'High' },
  [RequestPriority.MEDIUM]: { className: 'text-priority-medium', label: 'Medium' },
  [RequestPriority.LOW]: { className: 'text-priority-low', label: 'Low' },
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: RequestPriority
  className?: string
}) {
  const style = PRIORITY_STYLES[priority]
  return <span className={cn('text-sm', style.className, className)}>{style.label}</span>
}
