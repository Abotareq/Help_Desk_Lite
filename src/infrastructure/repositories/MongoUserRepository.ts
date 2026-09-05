import type { User } from '../../domain/entities/User';
import type { UserRole } from '../../domain/enums/UserRole';
import type { CreateUserData, IUserRepository, ListUsersFilter } from '../../domain/interfaces/IUserRepository';
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

  async countByRole(role: UserRole): Promise<number> {
    return UserModel.countDocuments({ role });
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
