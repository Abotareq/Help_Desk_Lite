import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

/** The thin breadcrumb-style bar at the top of every screen, as Frappe does it. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-sm font-semibold text-ink">{title}</h1>
        {subtitle ? <span className="text-xs text-ink-subtle">{subtitle}</span> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
