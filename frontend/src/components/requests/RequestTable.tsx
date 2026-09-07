import type { ReactNode } from 'react'

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
          <tr className="border-b border-line text-left text-xs font-medium text-ink-subtle">
            <th scope="col" className="py-2 pl-4 pr-3 font-medium">
              Ref
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Subject
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Status
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Priority
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Category
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Age
            </th>
            {trailingHeaders}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
