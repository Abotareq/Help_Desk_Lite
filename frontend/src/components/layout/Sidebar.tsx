import { NavLink } from 'react-router-dom'
import { useI18n } from '../../hooks/useI18n'
import { roleKey } from '../../i18n/keys'
import { LanguageToggle } from './LanguageToggle'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import { UserRole, type User } from '../../types/domain'
import type { MessageKey } from '../../i18n/en'

interface NavItem {
  to: string
  /** Message key, not text — the label is resolved at render, in the reader's language. */
  label: MessageKey
  /** Which roles see this item at all. */
  roles: UserRole[]
  end?: boolean
}

/**
 * One list, filtered by role, rather than a separate sidebar per persona. The
 * PRD treats the three views as views on the same data, and this keeps them
 * that way.
 */
const NAV: NavItem[] = [
  {
    to: '/',
    label: 'nav.myRequests',
    roles: [UserRole.EMPLOYEE, UserRole.AGENT, UserRole.MANAGER],
    end: true,
  },
  { to: '/queue', label: 'nav.queue', roles: [UserRole.AGENT] },
  { to: '/all', label: 'nav.allRequests', roles: [UserRole.MANAGER] },
  { to: '/dashboard', label: 'nav.dashboard', roles: [UserRole.MANAGER] },
  { to: '/people', label: 'nav.people', roles: [UserRole.MANAGER] },
]

interface SidebarProps {
  user: User
  onSignOut: () => void
  open: boolean
  onClose: () => void
}

/**
 * Closed means gone, not shrunk to a rail of single letters.
 *
 * Rendered or not, rather than pushed off with a negative margin: the margin
 * approach left the element in the layout and its open/closed classes fought
 * each other, so the sidebar could end up off-screen while claiming to be open.
 * Nothing to get wrong this way.
 *
 * Below md it overlays the content with a scrim, because a 224px pane docked
 * beside a phone-width page leaves nothing for the page. From md it is static
 * and takes its own column.
 */
export function Sidebar({ user, onSignOut, open, onClose }: SidebarProps) {
  const { t } = useI18n()
  const items = NAV.filter((item) => item.roles.includes(user.role))

  if (!open) return null

  return (
    <>
      {/* Tapping outside closes it — only present while it overlays content. */}
      <button
        type="button"
        aria-label={t('nav.close')}
        onClick={onClose}
        className="fixed inset-0 z-20 bg-scrim/40 md:hidden"
      />

      <aside
        className={cn(
          'z-30 flex w-56 shrink-0 flex-col border-e border-line bg-canvas',
          'fixed inset-y-0 start-0 md:static md:inset-auto',
        )}
      >
        <div className="flex h-12 items-center gap-2 px-3">
          <div className="flex size-6 shrink-0 items-center justify-center rounded bg-brand text-xs font-bold text-on-brand">
            H
          </div>
          <span className="truncate text-sm font-semibold text-ink">{t('app.name')}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.close')}
            className="ms-auto rounded p-1 text-ink-subtle hover:bg-line hover:text-ink"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="rtl:-scale-x-100"
            >
              <path
                d="M10 3L5 8l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              // Only on mobile, where the sidebar covers the page it just
              // navigated to. On a desktop it stays docked.
              onClick={() => {
                if (window.innerWidth < 768) onClose()
              }}
              className={({ isActive }) =>
                cn(
                  'flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors',
                  isActive
                    ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    : 'text-ink-muted hover:bg-line/60 hover:text-ink',
                )
              }
            >
              {t(item.label)}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line p-2">
          <div className="space-y-1.5 px-1 pb-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 px-1 py-1">
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{user.name}</p>
              <p className="truncate text-[11px] text-ink-subtle">{t(roleKey(user.role))}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onSignOut} className="mt-1 w-full justify-start">
            {t('nav.signOut')}
          </Button>
        </div>
      </aside>
    </>
  )
}
