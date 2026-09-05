import request from 'supertest';
import type { Express } from 'express';
import { UserService } from '../../src/application/services/UserService';
import { UserRole } from '../../src/domain/enums/UserRole';
import { MongoRequestRepository } from '../../src/infrastructure/repositories/MongoRequestRepository';
import { MongoUserRepository } from '../../src/infrastructure/repositories/MongoUserRepository';

export interface TestActor {
  id: string;
  email: string;
  role: UserRole;
  token: string;
}

/**
 * Creates a user straight through the service (bypassing the manager-only HTTP
 * route) and logs them in, so tests can get an authenticated actor in one line.
 */
export async function createActor(
  role: UserRole,
  overrides: { email?: string; name?: string; password?: string } = {},
): Promise<TestActor> {
  const service = new UserService(new MongoUserRepository(), new MongoRequestRepository());
  const email =
    overrides.email ??
    `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = overrides.password ?? 'password123';

  const user = await service.createUser({
    email,
    name: overrides.name ?? `Test ${role}`,
    role,
    password,
  });

  const { token } = await service.login({ email, password });
  return { id: user.id, email: user.email, role, token };
}

export function authed(app: Express, actor: TestActor) {
  const agent = request(app);
  return {
    get: (url: string) => agent.get(url).set('Authorization', `Bearer ${actor.token}`),
    post: (url: string) => agent.post(url).set('Authorization', `Bearer ${actor.token}`),
    patch: (url: string) => agent.patch(url).set('Authorization', `Bearer ${actor.token}`),
  };
}
