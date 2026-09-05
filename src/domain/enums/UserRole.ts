/**
 * The three roles v1 recognises. The PRD leaves finer-grained permissions to a
 * later version — see KAN-22 — so anything beyond these is deliberately absent.
 */
export enum UserRole {
  /** Submits requests and tracks their own. */
  EMPLOYEE = 'EMPLOYEE',
  /** Support/ops staff: claims, works and resolves requests. */
  AGENT = 'AGENT',
  /** Sees everything, assigns and reassigns, manages user accounts. */
  MANAGER = 'MANAGER',
}

export const USER_ROLES = Object.values(UserRole);

/** Roles allowed to own a request. Employees submit; they never handle. */
export const HANDLER_ROLES: readonly UserRole[] = [UserRole.AGENT, UserRole.MANAGER];

export function isHandlerRole(role: UserRole): boolean {
  return HANDLER_ROLES.includes(role);
}
