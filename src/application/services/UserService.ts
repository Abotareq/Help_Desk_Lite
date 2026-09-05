import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { toPublicUser, type PublicUser, type User } from '../../domain/entities/User';
import { OPEN_STATUSES } from '../../domain/enums/RequestStatus';
import { UserRole, isHandlerRole } from '../../domain/enums/UserRole';
import type { IRequestRepository } from '../../domain/interfaces/IRequestRepository';
import type {
  IUserRepository,
  ListUsersFilter,
  UpdateUserData,
} from '../../domain/interfaces/IUserRepository';
import { AppError } from '../../shared/AppError';
import type { CreateUserInput } from '../dtos/CreateUserSchema';
import type { LoginInput } from '../dtos/LoginSchema';
import type { ResetPasswordInput, UpdateUserInput } from '../dtos/UpdateUserSchema';

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

/** A request left without a usable owner by an account change. */
export interface OrphanedRequest {
  id: string;
  reference: string;
  status: string;
}

export interface UpdateUserResult {
  user: PublicUser;
  /**
   * Open requests this change left without a usable owner. Present so a manager
   * finds out at the moment they deactivate someone, rather than when a
   * requester chases an untouched ticket weeks later.
   */
  orphanedRequests: OrphanedRequest[];
}

/**
 * v1 has no public registration: accounts are created by a manager, and the
 * first manager comes from the seed script. That keeps an internal-only tool
 * internal without bolting on an invite flow.
 */
export class UserService {
  constructor(
    private readonly users: IUserRepository,
    private readonly requests: IRequestRepository,
  ) {}

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

  /**
   * Manager-only account administration. `isActive` already gated login and
   * assignment everywhere else in the system; until now nothing could set it,
   * so a leaver's account stayed usable indefinitely.
   */
  async updateUser(
    id: string,
    input: UpdateUserInput,
    actor: { id: string; role: UserRole },
  ): Promise<UpdateUserResult> {
    const target = await this.users.findById(id);
    if (!target) throw AppError.notFound('User not found');

    const nextRole = input.role ?? target.role;
    const nextActive = input.isActive ?? target.isActive;

    const losesAccess = target.isActive && !nextActive;
    const losesManagerRole = target.role === UserRole.MANAGER && nextRole !== UserRole.MANAGER;

    // Locking yourself out is never the intent, and it is unrecoverable without
    // database surgery.
    if (losesAccess && target.id === actor.id) {
      throw AppError.unprocessable('You cannot deactivate your own account');
    }
    if (losesManagerRole && target.id === actor.id) {
      throw AppError.unprocessable('You cannot remove your own manager role');
    }

    // Someone has to be able to administer the system tomorrow.
    if (target.role === UserRole.MANAGER && target.isActive && (losesAccess || losesManagerRole)) {
      const activeManagers = await this.users.countByRole(UserRole.MANAGER, { isActive: true });
      if (activeManagers <= 1) {
        throw AppError.unprocessable(
          'This is the last active manager. Promote another manager first, or nobody can administer the system.',
        );
      }
    }

    // Demoting a handler to EMPLOYEE strands their work just as deactivating
    // them does, so both paths report it.
    const losesAbilityToOwnWork =
      losesAccess || (isHandlerRole(target.role) && !isHandlerRole(nextRole));

    const orphanedRequests = losesAbilityToOwnWork
      ? await this.findOpenRequestsOwnedBy(target.id)
      : [];

    const changes: UpdateUserData = {};
    if (input.name !== undefined) changes.name = input.name;
    if (input.role !== undefined) changes.role = input.role;
    if (input.isActive !== undefined) changes.isActive = input.isActive;

    const updated = await this.users.update(id, changes);
    if (!updated) throw AppError.notFound('User not found');

    return { user: toPublicUser(updated), orphanedRequests };
  }

  /** v1 has no self-service recovery, so a manager resets the password directly. */
  async resetPassword(id: string, input: ResetPasswordInput): Promise<PublicUser> {
    const target = await this.users.findById(id);
    if (!target) throw AppError.notFound('User not found');

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const updated = await this.users.update(id, { passwordHash });
    if (!updated) throw AppError.notFound('User not found');

    return toPublicUser(updated);
  }

  private async findOpenRequestsOwnedBy(userId: string): Promise<OrphanedRequest[]> {
    const { items } = await this.requests.search({
      assigneeId: userId,
      status: [...OPEN_STATUSES],
      limit: 100,
    });

    return items.map((r) => ({ id: r.id, reference: r.reference, status: r.status }));
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
