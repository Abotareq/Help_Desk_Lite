import type { User } from '../../src/domain/entities/User';
import type { UserRole } from '../../src/domain/enums/UserRole';
import type {
  CreateUserData,
  IUserRepository,
  ListUsersFilter,
  UpdateUserData,
} from '../../src/domain/interfaces/IUserRepository';

/**
 * In-memory stand-in for IUserRepository. Unit tests use this instead of a
 * database — it is the whole point of the repository interface existing.
 */
export class FakeUserRepository implements IUserRepository {
  private readonly users = new Map<string, User>();
  private sequence = 0;

  async create(data: CreateUserData): Promise<User> {
    const now = new Date();
    const id = (++this.sequence).toString().padStart(24, '0');
    const user: User = { id, ...data, isActive: true, createdAt: now, updatedAt: now };
    this.users.set(id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const target = email.toLowerCase().trim();
    return [...this.users.values()].find((u) => u.email === target) ?? null;
  }

  async list(filter: ListUsersFilter = {}): Promise<User[]> {
    return [...this.users.values()]
      .filter((u) => (filter.role ? u.role === filter.role : true))
      .filter((u) => (filter.isActive === undefined ? true : u.isActive === filter.isActive))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) return null;

    if (data.name !== undefined) existing.name = data.name;
    if (data.role !== undefined) existing.role = data.role;
    if (data.isActive !== undefined) existing.isActive = data.isActive;
    if (data.passwordHash !== undefined) existing.passwordHash = data.passwordHash;
    existing.updatedAt = new Date();

    return { ...existing };
  }

  async countByRole(role: UserRole, filter: { isActive?: boolean } = {}): Promise<number> {
    return [...this.users.values()].filter(
      (u) => u.role === role && (filter.isActive === undefined || u.isActive === filter.isActive),
    ).length;
  }

  /** Test helper — not part of the interface. */
  deactivate(email: string): void {
    const user = [...this.users.values()].find((u) => u.email === email.toLowerCase());
    if (user) user.isActive = false;
  }
}
