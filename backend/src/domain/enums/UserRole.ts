/**
 * The three roles v1 recognises. The PRD leaves finer-grained permissions to a
 * later version — see KAN-22 — so anything beyond these is deliberately absent.
 */
export enum UserRole {
  /** Submits requests and tracks their own. */
  EMPLOYEE = 'EMPLOYEE',
  /** Support/ops staff: claims, works and resolves requests. */
  AGENT = 'AGENT',
  /**
   * Oversight. Sees everything, assigns and reassigns, manages accounts — but
   * does not work the queue: a manager cannot claim or be assigned a request.
   */
  MANAGER = 'MANAGER',
}

export const USER_ROLES = Object.values(UserRole);

/**
 * Roles allowed to own a request — agents only.
 *
 * Employees submit and never handle. Managers direct the work rather than doing
 * it: letting them claim would blur the two roles and stop the queue being the
 * agents' queue. A manager who needs a request moved assigns it, or moves its
 * status directly, both of which they can still do.
 */
export const HANDLER_ROLES: readonly UserRole[] = [UserRole.AGENT];

export function isHandlerRole(role: UserRole): boolean {
  return HANDLER_ROLES.includes(role);
}
