import type { User } from '../entities/User';
import type { UserRole } from '../enums/UserRole';

export interface CreateUserData {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}

export interface ListUsersFilter {
  role?: UserRole;
  isActive?: boolean;
}

/**
 * The seam between the application layer and storage. Services depend on this
 * interface only; unit tests substitute an in-memory fake for it.
 */
export interface IUserRepository {
  create(data: CreateUserData): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(filter?: ListUsersFilter): Promise<User[]>;
  countByRole(role: UserRole): Promise<number>;
}
