import { ApiError } from '../../api/client'
import { useChangeCategory } from '../../hooks/useRequests'
import { CATEGORY_ORDER, categoryLabel } from '../../lib/status'
import { RequestCategory, type SupportRequest } from '../../types/domain'
import { Alert } from '../ui/Alert'
import { Select } from '../ui/Select'

/**
 * Recategorising, for whoever is handling the request.
 *
 * The same fixed list the submission form offers, because a category that
 * describes rather than routes is only useful while everyone picks from one set.
 * Whether this is shown at all is decided by the caller against the workflow
 * mirror, so a requester never sees a control the API would refuse them.
 */
export function CategoryControl({ request }: { request: SupportRequest }) {
  const change = useChangeCategory(request.id)

  return (
    <div className="space-y-2">
      <Select
        aria-label="Category"
        value={request.category}
        disabled={change.isPending}
        onChange={(e) => change.mutate(e.target.value as RequestCategory)}
      >
        {CATEGORY_ORDER.map((category) => (
          <option key={category} value={category}>
            {categoryLabel(category)}
          </option>
        ))}
      </Select>

      {change.isError ? (
        <Alert>
          {change.error instanceof ApiError
            ? change.error.message
            : 'Could not change the category.'}
        </Alert>
      ) : null}
    </div>
  )
}
