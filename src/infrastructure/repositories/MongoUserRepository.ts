import type { User } from '../../domain/entities/User';
import type { UserRole } from '../../domain/enums/UserRole';
import type {
  CreateUserData,
  IUserRepository,
  ListUsersFilter,
  UpdateUserData,
} from '../../domain/interfaces/IUserRepository';
import { UserModel, type UserHydrated } from '../database/models/UserModel';

/** The only place that knows users live in Mongo. */
export class MongoUserRepository implements IUserRepository {
  async create(data: CreateUserData): Promise<User> {
    const created = await UserModel.create(data);
    return toDomain(created);
  }

  async findById(id: string): Promise<User | null> {
    if (!isObjectIdLike(id)) return null;
    const doc = await UserModel.findById(id).select('+passwordHash');
    return doc ? toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    return doc ? toDomain(doc) : null;
  }

  async list(filter: ListUsersFilter = {}): Promise<User[]> {
    const query: Record<string, unknown> = {};
    if (filter.role) query.role = filter.role;
    if (filter.isActive !== undefined) query.isActive = filter.isActive;

    const docs = await UserModel.find(query).sort({ name: 1 });
    return docs.map(toDomain);
  }

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    if (!isObjectIdLike(id)) return null;

    const $set: Record<string, unknown> = {};
    if (data.name !== undefined) $set.name = data.name;
    if (data.role !== undefined) $set.role = data.role;
    if (data.isActive !== undefined) $set.isActive = data.isActive;
    if (data.passwordHash !== undefined) $set.passwordHash = data.passwordHash;

    if (Object.keys($set).length === 0) return this.findById(id);

    const doc = await UserModel.findByIdAndUpdate(id, { $set }, { new: true }).select('+passwordHash');
    return doc ? toDomain(doc) : null;
  }

  async countByRole(role: UserRole, filter: { isActive?: boolean } = {}): Promise<number> {
    const query: Record<string, unknown> = { role };
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    return UserModel.countDocuments(query);
  }
}

function toDomain(doc: UserHydrated): User {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    passwordHash: doc.passwordHash,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Guards against Mongoose throwing a CastError on a malformed id in the URL. */
function isObjectIdLike(value: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(value);
}
