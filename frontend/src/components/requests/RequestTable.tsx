import type { ReactNode } from 'react'
import { useI18n } from '../../hooks/useI18n'

interface RequestTableProps {
  /** Extra column headers matching whatever `trailing` cells the rows render. */
  trailingHeaders?: ReactNode
  children: ReactNode
}

/**
 * The fixed columns total 34rem, and callers add up to 15rem more of their own
 * (owner, requester, a claim button). The minimum has to clear both, or the
 * only flexible column — the subject — is squeezed to nothing and its header
 * collides with the next one. Below that width the table scrolls instead.
 */
export function RequestTable({ trailingHeaders, children }: RequestTableProps) {
  const { t } = useI18n()

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[60rem] table-fixed border-collapse">
        <colgroup>
          <col className="w-28" />
          <col />
          <col className="w-32" />
          <col className="w-24" />
          <col className="w-28" />
          <col className="w-24" />
        </colgroup>
        <thead>
          <tr className="border-b border-line text-start text-xs font-medium text-ink-subtle">
            <th scope="col" className="py-2 ps-4 pe-3 font-medium">
              {t('requests.colRef')}
            </th>
            <th scope="col" className="py-2 pe-3 font-medium">
              {t('requests.colSubject')}
            </th>
            <th scope="col" className="py-2 pe-3 font-medium">
              {t('requests.colStatus')}
            </th>
            <th scope="col" className="py-2 pe-3 font-medium">
              {t('requests.colPriority')}
            </th>
            <th scope="col" className="py-2 pe-3 font-medium">
              {t('requests.colCategory')}
            </th>
            <th scope="col" className="py-2 pe-3 font-medium">
              {t('requests.colAge')}
            </th>
            {trailingHeaders}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
