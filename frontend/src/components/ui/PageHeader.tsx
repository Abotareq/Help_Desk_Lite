import type { ReactNode } from 'react'
import { useSidebar } from '../layout/sidebarContext'
import { useI18n } from '../../hooks/useI18n'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  /**
   * Set when the title or subtitle is the user's text rather than ours — a
   * request's own subject, for instance, which may not be in the page's
   * language and must not inherit its direction.
   */
  contentDir?: 'auto' | 'ltr' | 'rtl'
}

/** The thin breadcrumb-style bar at the top of every screen, as Frappe does it. */
export function PageHeader({ title, subtitle, actions, contentDir }: PageHeaderProps) {
  const { t } = useI18n()

  const sidebar = useSidebar()

  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-surface px-3 py-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        {/* The way back in once the sidebar is closed. */}
        {sidebar && !sidebar.open ? (
          <button
            type="button"
            onClick={sidebar.toggle}
            aria-label={t('nav.open')}
            className="-ms-1 shrink-0 rounded p-1 text-ink-muted hover:bg-canvas hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2.5 4h11M2.5 8h11M2.5 12h11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h1 dir={contentDir} className="truncate text-sm font-semibold text-ink">
            {title}
          </h1>
          {subtitle ? (
            <span dir={contentDir} className="truncate text-xs text-ink-subtle">
              {subtitle}
            </span>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
