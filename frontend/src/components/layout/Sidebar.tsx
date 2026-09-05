import { NavLink } from 'react-router-dom'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import { UserRole, type User } from '../../types/domain'

interface NavItem {
  to: string
  label: string
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
  { to: '/', label: 'My requests', roles: [UserRole.EMPLOYEE, UserRole.AGENT, UserRole.MANAGER], end: true },
  { to: '/queue', label: 'Queue', roles: [UserRole.AGENT, UserRole.MANAGER] },
  { to: '/all', label: 'All requests', roles: [UserRole.MANAGER] },
  { to: '/dashboard', label: 'Dashboard', roles: [UserRole.MANAGER] },
  { to: '/people', label: 'People', roles: [UserRole.MANAGER] },
]

interface SidebarProps {
  user: User
  onSignOut: () => void
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ user, onSignOut, collapsed, onToggle }: SidebarProps) {
  const items = NAV.filter((item) => item.roles.includes(user.role))

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-line bg-canvas transition-all',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <div className="flex h-12 items-center gap-2 px-3">
        <div className="flex size-6 shrink-0 items-center justify-center rounded bg-brand text-xs font-bold text-white">
          H
        </div>
        {!collapsed ? (
          <span className="truncate text-sm font-semibold text-ink">HelpDesk Lite</span>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="ml-auto rounded p-1 text-ink-subtle hover:bg-line hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d={collapsed ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors',
                isActive
                  ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-ink-muted hover:bg-line/60 hover:text-ink',
                collapsed && 'justify-center px-0',
              )
            }
          >
            {collapsed ? item.label.charAt(0) : item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-2">
        <div className={cn('flex items-center gap-2 px-1 py-1', collapsed && 'justify-center')}>
          <Avatar name={user.name} />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{user.name}</p>
              <p className="truncate text-[11px] text-ink-subtle">{user.role.toLowerCase()}</p>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <Button variant="ghost" size="sm" onClick={onSignOut} className="mt-1 w-full justify-start">
            Sign out
          </Button>
        ) : null}
      </div>
    </aside>
  )
}
