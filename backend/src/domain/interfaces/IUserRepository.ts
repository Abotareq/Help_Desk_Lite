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

/** Fields a manager may change on an existing account. Email is identity and is not one of them. */
export interface UpdateUserData {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  passwordHash?: string;
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
  update(id: string, data: UpdateUserData): Promise<User | null>;
  countByRole(role: UserRole, filter?: { isActive?: boolean }): Promise<number>;
}
