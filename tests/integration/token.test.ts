import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import { UserRole } from '../../src/domain/enums/UserRole';
import { createActor, type TestActor } from '../helpers/api';
import { clearTestDb, startTestDb, stopTestDb } from '../setup/testDb';

const app = createApp();

let employee: TestActor;

beforeAll(async () => {
  await startTestDb();
});
beforeEach(async () => {
  employee = await createActor(UserRole.EMPLOYEE);
});
afterEach(async () => {
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

function tokenFor(actor: TestActor, options: jwt.SignOptions): string {
  return jwt.sign(
    { sub: actor.id, email: actor.email, role: actor.role },
    env.JWT_SECRET,
    options,
  );
}

function callWith(token: string) {
  return request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
}

describe('token verification', () => {
  it('accepts a token that is still valid', async () => {
    const res = await callWith(tokenFor(employee, { expiresIn: '1h' }));

    expect(res.status).toBe(200);
  });

  it('rejects an expired token', async () => {
    // Signed already-expired: the exp claim is in the past the moment it exists.
    const res = await callWith(tokenFor(employee, { expiresIn: '-1s' }));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token that expires between issue and use', async () => {
    const token = tokenFor(employee, { expiresIn: '1s' });

    await expect(callWith(token).then((r) => r.status)).resolves.toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const after = await callWith(token);
    expect(after.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = jwt.sign(
      { sub: employee.id, email: employee.email, role: UserRole.MANAGER },
      'not-the-real-secret-value',
      { expiresIn: '1h' },
    );

    const res = await callWith(forged);

    expect(res.status).toBe(401);
  });

  it('rejects a token whose payload has been tampered with', async () => {
    // Swap the role claim for MANAGER but keep the original signature.
    const [header, payload, signature] = tokenFor(employee, { expiresIn: '1h' }).split('.');
    const decoded = JSON.parse(Buffer.from(payload as string, 'base64url').toString());
    decoded.role = UserRole.MANAGER;
    const tampered = [
      header,
      Buffer.from(JSON.stringify(decoded)).toString('base64url'),
      signature,
    ].join('.');

    const res = await callWith(tampered);

    expect(res.status).toBe(401);
  });

  it('rejects an unsigned "alg: none" token', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: employee.id, email: employee.email, role: UserRole.MANAGER }),
    ).toString('base64url');

    const res = await callWith(`${header}.${payload}.`);

    expect(res.status).toBe(401);
  });
});
