import request from 'supertest';
import { createApp } from '../../src/app';
import { UserRole } from '../../src/domain/enums/UserRole';
import { authed, createActor } from '../helpers/api';
import { clearTestDb, startTestDb, stopTestDb } from '../setup/testDb';

const app = createApp();

beforeAll(async () => {
  await startTestDb();
});
afterEach(async () => {
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

describe('POST /api/auth/login', () => {
  it('returns a token and the user for valid credentials', async () => {
    await createActor(UserRole.AGENT, { email: 'agent@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('agent@example.com');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a bad password with 401', async () => {
    await createActor(UserRole.AGENT, { email: 'agent2@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agent2@example.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed body with 400 and field details', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
    );
  });
});

describe('user routes', () => {
  it('requires a bearer token', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', 'Bearer nonsense');

    expect(res.status).toBe(401);
  });

  it('returns the caller from /me', async () => {
    const employee = await createActor(UserRole.EMPLOYEE);

    const res = await authed(app, employee).get('/api/users/me');

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(employee.id);
    expect(res.body.user.role).toBe(UserRole.EMPLOYEE);
  });

  it('lets a manager create a user', async () => {
    const manager = await createActor(UserRole.MANAGER);

    const res = await authed(app, manager).post('/api/users').send({
      email: 'new.agent@example.com',
      name: 'New Agent',
      role: UserRole.AGENT,
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe(UserRole.AGENT);
  });

  it('stops a non-manager creating a user', async () => {
    const agent = await createActor(UserRole.AGENT);

    const res = await authed(app, agent).post('/api/users').send({
      email: 'sneaky@example.com',
      name: 'Sneaky',
      role: UserRole.MANAGER,
      password: 'password123',
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('stops an employee listing users', async () => {
    const employee = await createActor(UserRole.EMPLOYEE);

    const res = await authed(app, employee).get('/api/users');

    expect(res.status).toBe(403);
  });

  it('filters the user list by role', async () => {
    const manager = await createActor(UserRole.MANAGER);
    await createActor(UserRole.AGENT);
    await createActor(UserRole.EMPLOYEE);

    const res = await authed(app, manager).get(`/api/users?role=${UserRole.AGENT}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.users[0].role).toBe(UserRole.AGENT);
  });
});
