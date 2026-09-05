import bcrypt from 'bcryptjs';
import request from 'supertest';
import { readSeedConfig, seedBootstrapManager } from '../../scripts/seed';
import { createApp } from '../../src/app';
import { UserRole } from '../../src/domain/enums/UserRole';
import { MongoUserRepository } from '../../src/infrastructure/repositories/MongoUserRepository';
import { clearTestDb, startTestDb, stopTestDb } from '../setup/testDb';

const app = createApp();

const config = {
  email: 'boss@example.com',
  password: 'BootstrapPass123!',
  name: 'Bootstrap Manager',
};

beforeAll(async () => {
  await startTestDb();
});
afterEach(async () => {
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

describe('readSeedConfig', () => {
  it('reads the manager details from the environment', () => {
    const parsed = readSeedConfig({
      SEED_MANAGER_EMAIL: 'a@b.com',
      SEED_MANAGER_PASSWORD: 'secret123',
      SEED_MANAGER_NAME: 'Ada',
    } as NodeJS.ProcessEnv);

    expect(parsed).toEqual({ email: 'a@b.com', password: 'secret123', name: 'Ada' });
  });

  it('defaults the name when it is not set', () => {
    const parsed = readSeedConfig({
      SEED_MANAGER_EMAIL: 'a@b.com',
      SEED_MANAGER_PASSWORD: 'secret123',
    } as NodeJS.ProcessEnv);

    expect(parsed.name).toBe('Bootstrap Manager');
  });

  it('refuses to seed without an email', () => {
    expect(() =>
      readSeedConfig({ SEED_MANAGER_PASSWORD: 'secret123' } as NodeJS.ProcessEnv),
    ).toThrow(/SEED_MANAGER_EMAIL/);
  });

  it('refuses to seed without a password', () => {
    expect(() =>
      readSeedConfig({ SEED_MANAGER_EMAIL: 'a@b.com' } as NodeJS.ProcessEnv),
    ).toThrow(/SEED_MANAGER_PASSWORD/);
  });
});

describe('seedBootstrapManager', () => {
  it('creates a MANAGER account', async () => {
    const result = await seedBootstrapManager(new MongoUserRepository(), config);

    expect(result.created).toBe(true);
    expect(result.user.role).toBe(UserRole.MANAGER);
    expect(result.user.email).toBe(config.email);
  });

  it('hashes the password rather than storing it', async () => {
    await seedBootstrapManager(new MongoUserRepository(), config);

    const stored = await new MongoUserRepository().findByEmail(config.email);
    expect(stored?.passwordHash).not.toBe(config.password);
    await expect(bcrypt.compare(config.password, stored!.passwordHash)).resolves.toBe(true);
  });

  it('never returns the password hash', async () => {
    const result = await seedBootstrapManager(new MongoUserRepository(), config);

    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('is idempotent — running twice leaves one manager, not two', async () => {
    await seedBootstrapManager(new MongoUserRepository(), config);
    const second = await seedBootstrapManager(new MongoUserRepository(), config);

    expect(second.created).toBe(false);

    const managers = await new MongoUserRepository().list({ role: UserRole.MANAGER });
    expect(managers).toHaveLength(1);
  });

  it('does not overwrite the password of an existing manager', async () => {
    await seedBootstrapManager(new MongoUserRepository(), config);
    await seedBootstrapManager(new MongoUserRepository(), { ...config, password: 'DifferentPass9!' });

    const stored = await new MongoUserRepository().findByEmail(config.email);
    await expect(bcrypt.compare(config.password, stored!.passwordHash)).resolves.toBe(true);
  });
});

describe('the seeded manager is actually usable', () => {
  // The whole point of the seed script: without this path working, a fresh
  // deployment has no way in at all.
  it('can log in and create the first agent', async () => {
    await seedBootstrapManager(new MongoUserRepository(), config);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: config.email, password: config.password });

    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe(UserRole.MANAGER);

    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        email: 'first.agent@example.com',
        name: 'First Agent',
        role: UserRole.AGENT,
        password: 'password123',
      });

    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe(UserRole.AGENT);
  });
});
