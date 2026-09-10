import type { RequestCategory, RequestPriority, RequestStatus, UserRole } from '../types/domain'
import type { ThemePreference } from '../features/theme/themeContext'
import type { MessageKey } from './en'

/**
 * Enum values into message keys.
 *
 * Typed rather than built inline at each call site, so adding a status without
 * adding its translation is a compile error here instead of a raw `IN_PROGRESS`
 * appearing on screen.
 */
export function statusKey(status: RequestStatus): MessageKey {
  return `status.${status}`
}

export function priorityKey(priority: RequestPriority): MessageKey {
  return `priority.${priority}`
}

export function categoryKey(category: RequestCategory): MessageKey {
  return `category.${category}`
}

export function roleKey(role: UserRole): MessageKey {
  return `role.${role}`
}

export function themeKey(preference: ThemePreference): MessageKey {
  return `theme.${preference === 'system' ? 'system' : preference}`
}
