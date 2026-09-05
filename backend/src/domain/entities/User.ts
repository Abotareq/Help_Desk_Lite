import type { UserRole } from '../enums/UserRole';

/**
 * Framework-agnostic shape of a user. No Mongoose types leak in here — the
 * repository is responsible for mapping documents onto this.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** What a user looks like once it leaves the API — never carries the hash. */
export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
