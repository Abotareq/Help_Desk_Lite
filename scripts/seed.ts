/**
 * Bootstraps the first MANAGER account. Every other user is created through
 * POST /api/users by a manager, so without this there is no way in.
 *
 *   npm run seed
 */
import { UserService } from '../src/application/services/UserService';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';
import { UserRole } from '../src/domain/enums/UserRole';
import { MongoUserRepository } from '../src/infrastructure/repositories/MongoUserRepository';

async function seed(): Promise<void> {
  const email = process.env.SEED_MANAGER_EMAIL;
  const password = process.env.SEED_MANAGER_PASSWORD;
  const name = process.env.SEED_MANAGER_NAME ?? 'Bootstrap Manager';

  if (!email || !password) {
    throw new Error('Set SEED_MANAGER_EMAIL and SEED_MANAGER_PASSWORD before seeding');
  }

  await connectDatabase(env.MONGODB_URI);

  const repository = new MongoUserRepository();
  const service = new UserService(repository);

  const existing = await repository.findByEmail(email);
  if (existing) {
    console.log(`Manager ${email} already exists — nothing to do.`);
  } else {
    const user = await service.createUser({ email, name, password, role: UserRole.MANAGER });
    console.log(`Created manager ${user.email} (${user.id})`);
  }

  await disconnectDatabase();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
