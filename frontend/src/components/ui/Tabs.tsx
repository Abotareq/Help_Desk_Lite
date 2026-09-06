import { cn } from '../../lib/cn'

export interface TabDefinition<T extends string> {
  id: T
  label: string
  /** Shown as a count beside the label; omitted while it is still loading. */
  count?: number
}

interface TabsProps<T extends string> {
  tabs: TabDefinition<T>[]
  active: T
  onChange: (id: T) => void
}

/** The saved-view switcher from the Frappe list, scaled to what v1 has. */
export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <div role="tablist" className="flex items-center gap-1">
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors',
              isActive
                ? 'bg-canvas font-medium text-ink'
                : 'text-ink-muted hover:bg-canvas hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={cn('text-xs', isActive ? 'text-ink-muted' : 'text-ink-subtle')}>
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
