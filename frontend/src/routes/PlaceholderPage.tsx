import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'

/**
 * Stands in until the feature slice for this route lands. Present so the shell,
 * navigation and role gating can be reviewed and tested on their own.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="flex-1 overflow-auto">
        <EmptyState
          title={`${title} is not built yet`}
          description="The shell, sign-in and navigation are in place. This screen arrives in its own increment."
        />
      </div>
    </>
  )
}
