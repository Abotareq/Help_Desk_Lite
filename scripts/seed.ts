/**
 * Bootstraps the first MANAGER account. Every other user is created through
 * POST /api/users by a manager, so without this there is no way in.
 *
 *   npm run seed
 *
 * The logic is split from the CLI wiring so it can be tested: importing this
 * module has no side effects, and `main()` only runs when it is the entry point.
 */
import { UserService } from '../src/application/services/UserService';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';
import { UserRole } from '../src/domain/enums/UserRole';
import type { PublicUser } from '../src/domain/entities/User';
import type { IUserRepository } from '../src/domain/interfaces/IUserRepository';
import { MongoUserRepository } from '../src/infrastructure/repositories/MongoUserRepository';

export interface SeedConfig {
  email: string;
  password: string;
  name: string;
}

export interface SeedResult {
  /** False when a manager with that email was already present. */
  created: boolean;
  user: PublicUser;
}

/** Reads and validates the seed configuration, failing loudly rather than seeding a blank account. */
export function readSeedConfig(source: NodeJS.ProcessEnv = process.env): SeedConfig {
  const email = source.SEED_MANAGER_EMAIL;
  const password = source.SEED_MANAGER_PASSWORD;

  if (!email || !password) {
    throw new Error('Set SEED_MANAGER_EMAIL and SEED_MANAGER_PASSWORD before seeding');
  }

  return { email, password, name: source.SEED_MANAGER_NAME ?? 'Bootstrap Manager' };
}

/**
 * Idempotent: running it twice leaves one manager, not two. A seed that fails
 * on a second run is a seed nobody dares re-run.
 */
export async function seedBootstrapManager(
  users: IUserRepository,
  config: SeedConfig,
): Promise<SeedResult> {
  const service = new UserService(users);

  const existing = await users.findByEmail(config.email);
  if (existing) {
    const { passwordHash: _passwordHash, ...publicUser } = existing;
    return { created: false, user: publicUser };
  }

  const user = await service.createUser({
    email: config.email,
    name: config.name,
    password: config.password,
    role: UserRole.MANAGER,
  });

  return { created: true, user };
}

async function main(): Promise<void> {
  const config = readSeedConfig();

  await connectDatabase(env.MONGODB_URI);
  try {
    const { created, user } = await seedBootstrapManager(new MongoUserRepository(), config);
    // eslint-disable-next-line no-console
    console.log(
      created
        ? `Created manager ${user.email} (${user.id})`
        : `Manager ${user.email} already exists — nothing to do.`,
    );
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
