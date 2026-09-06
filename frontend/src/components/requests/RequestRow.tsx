import { Link } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { PriorityBadge } from '../ui/PriorityBadge'
import { StatusBadge } from '../ui/StatusBadge'
import { timeAgo } from '../../lib/time'
import type { SupportRequest } from '../../types/domain'
import type { ReactNode } from 'react'

interface RequestRowProps {
  request: SupportRequest
  /** Extra cells the calling view needs — assignee, a claim button, and so on. */
  trailing?: ReactNode
}

/**
 * One line in a request table. Dense, in the Frappe idiom: the whole row is a
 * link, and colour appears only on the status dot and the priority.
 */
export function RequestRow({ request, trailing }: RequestRowProps) {
  return (
    <tr className="group border-b border-line last:border-0 hover:bg-canvas">
      <td className="whitespace-nowrap py-2 pl-4 pr-3 align-middle">
        <Link
          to={`/requests/${request.id}`}
          className="font-mono text-xs text-ink-muted group-hover:text-brand"
        >
          {request.reference}
        </Link>
      </td>
      <td className="max-w-0 py-2 pr-3 align-middle">
        <Link to={`/requests/${request.id}`} className="block truncate text-sm text-ink">
          {request.title}
        </Link>
      </td>
      <td className="whitespace-nowrap py-2 pr-3 align-middle">
        <StatusBadge status={request.status} />
      </td>
      <td className="whitespace-nowrap py-2 pr-3 align-middle">
        <PriorityBadge priority={request.priority} />
      </td>
      <td className="whitespace-nowrap py-2 pr-3 align-middle">
        <Badge>{request.category}</Badge>
      </td>
      <td className="whitespace-nowrap py-2 pr-3 align-middle text-xs text-ink-subtle">
        {timeAgo(request.createdAt)}
      </td>
      {trailing}
    </tr>
  )
}
