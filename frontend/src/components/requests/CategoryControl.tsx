import { ApiError } from '../../api/client'
import { useChangeCategory } from '../../hooks/useRequests'
import { useI18n } from '../../hooks/useI18n'
import { categoryKey } from '../../i18n/keys'
import { CATEGORY_ORDER } from '../../lib/status'
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
  const { t } = useI18n()
  const change = useChangeCategory(request.id)

  return (
    <div className="space-y-2">
      <Select
        aria-label={t('detail.category')}
        value={request.category}
        disabled={change.isPending}
        onChange={(e) => change.mutate(e.target.value as RequestCategory)}
      >
        {CATEGORY_ORDER.map((category) => (
          <option key={category} value={category}>
            {t(categoryKey(category))}
          </option>
        ))}
      </Select>

      {change.isError ? (
        <Alert>
          {change.error instanceof ApiError
            ? change.error.message
            : t('category.changeFailed')}
        </Alert>
      ) : null}
    </div>
  )
}
