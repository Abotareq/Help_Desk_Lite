import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { toPublicUser, type PublicUser, type User } from '../../domain/entities/User';
import { UserRole } from '../../domain/enums/UserRole';
import type { IUserRepository, ListUsersFilter } from '../../domain/interfaces/IUserRepository';
import { AppError } from '../../shared/AppError';
import type { CreateUserInput } from '../dtos/CreateUserSchema';
import type { LoginInput } from '../dtos/LoginSchema';

const SALT_ROUNDS = 10;

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

/**
 * v1 has no public registration: accounts are created by a manager, and the
 * first manager comes from the seed script. That keeps an internal-only tool
 * internal without bolting on an invite flow.
 */
export class UserService {
  constructor(private readonly users: IUserRepository) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email);

    // Same error either way — telling a caller which half was wrong tells them
    // which emails exist.
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw AppError.unauthorized('Invalid email or password');
    }
    if (!user.isActive) {
      throw AppError.forbidden('This account has been deactivated');
    }

    return { token: this.issueToken(user), user: toPublicUser(user) };
  }

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict('A user with that email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const created = await this.users.create({
      email: input.email.toLowerCase().trim(),
      name: input.name,
      role: input.role,
      passwordHash,
    });

    return toPublicUser(created);
  }

  async listUsers(filter: ListUsersFilter = {}): Promise<PublicUser[]> {
    const users = await this.users.list(filter);
    return users.map(toPublicUser);
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw AppError.notFound('User not found');
    return toPublicUser(user);
  }

  /** Used when assigning work — the target has to exist and be able to hold a request. */
  async getActiveHandler(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw AppError.notFound('User not found');
    if (!user.isActive) throw AppError.unprocessable('That user has been deactivated');
    if (user.role === UserRole.EMPLOYEE) {
      throw AppError.unprocessable('Requests can only be owned by support staff or a manager');
    }
    return toPublicUser(user);
  }

  private issueToken(user: User): string {
    const payload: AuthTokenPayload = { sub: user.id, email: user.email, role: user.role };
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }
}
