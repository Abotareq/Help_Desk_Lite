import request from 'supertest';
import { createApp } from '../../src/app';
import { RequestCategory } from '../../src/domain/enums/RequestCategory';
import { RequestStatus } from '../../src/domain/enums/RequestStatus';
import { UserRole } from '../../src/domain/enums/UserRole';
import { authed, createActor, type TestActor } from '../helpers/api';
import { clearTestDb, startTestDb, stopTestDb } from '../setup/testDb';

const app = createApp();

let manager: TestActor;
let otherManager: TestActor;
let agent: TestActor;
let employee: TestActor;

beforeAll(async () => {
  await startTestDb();
});

beforeEach(async () => {
  manager = await createActor(UserRole.MANAGER);
  otherManager = await createActor(UserRole.MANAGER);
  agent = await createActor(UserRole.AGENT);
  employee = await createActor(UserRole.EMPLOYEE);
});

afterEach(async () => {
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

describe('PATCH /api/users/:id', () => {
  it('lets a manager rename an account', async () => {
    const res = await authed(app, manager).patch(`/api/users/${agent.id}`).send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('lets a manager change a role', async () => {
    const res = await authed(app, manager)
      .patch(`/api/users/${employee.id}`)
      .send({ role: UserRole.AGENT });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(UserRole.AGENT);
  });

  it('deactivates an account, and login then refuses it', async () => {
    const res = await authed(app, manager).patch(`/api/users/${agent.id}`).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: agent.email, password: 'password123' });

    expect(login.status).toBe(403);
  });

  it('reactivates an account', async () => {
    await authed(app, manager).patch(`/api/users/${agent.id}`).send({ isActive: false });

    const res = await authed(app, manager).patch(`/api/users/${agent.id}`).send({ isActive: true });

    expect(res.body.user.isActive).toBe(true);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: agent.email, password: 'password123' });
    expect(login.status).toBe(200);
  });

  describe('authorisation', () => {
    it('403s an agent', async () => {
      const res = await authed(app, agent).patch(`/api/users/${employee.id}`).send({ name: 'Nope' });

      expect(res.status).toBe(403);
    });

    it('403s an employee', async () => {
      const res = await authed(app, employee)
        .patch(`/api/users/${employee.id}`)
        .send({ name: 'Self Promote' });

      expect(res.status).toBe(403);
    });

    it('401s without a token', async () => {
      const res = await request(app).patch(`/api/users/${agent.id}`).send({ name: 'Nope' });

      expect(res.status).toBe(401);
    });
  });

  describe('guards', () => {
    it('422s a manager deactivating themselves', async () => {
      const res = await authed(app, manager)
        .patch(`/api/users/${manager.id}`)
        .send({ isActive: false });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/your own account/i);
    });

    it('422s a manager dropping their own manager role', async () => {
      const res = await authed(app, manager)
        .patch(`/api/users/${manager.id}`)
        .send({ role: UserRole.AGENT });

      expect(res.status).toBe(422);
    });

    it('422s deactivating the last active manager', async () => {
      // Leave `manager` as the only active one.
      await authed(app, manager).patch(`/api/users/${otherManager.id}`).send({ isActive: false });

      const res = await authed(app, otherManager)
        .patch(`/api/users/${manager.id}`)
        .send({ isActive: false });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/last active manager/i);
    });
  });

  describe('validation', () => {
    it('400s an empty body', async () => {
      const res = await authed(app, manager).patch(`/api/users/${agent.id}`).send({});

      expect(res.status).toBe(400);
    });

    it('400s an unknown role', async () => {
      const res = await authed(app, manager)
        .patch(`/api/users/${agent.id}`)
        .send({ role: 'SUPERUSER' });

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('role');
    });

    it('404s an unknown user', async () => {
      const res = await authed(app, manager)
        .patch('/api/users/000000000000000000000099')
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });

    it('404s a malformed id', async () => {
      const res = await authed(app, manager).patch('/api/users/not-an-id').send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('work left behind', () => {
    it('reports the open requests a deactivation strands', async () => {
      const created = await authed(app, employee).post('/api/requests').send({
        title: 'Printer jams on every job',
        description: 'The shared printer jams on every job and has to be cleared by hand.',
        category: RequestCategory.IT,
      });
      await authed(app, agent).post(`/api/requests/${created.body.request.id}/claim`);

      const res = await authed(app, manager)
        .patch(`/api/users/${agent.id}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.orphanedRequests).toEqual([
        {
          id: created.body.request.id,
          reference: created.body.request.reference,
          status: RequestStatus.IN_PROGRESS,
        },
      ]);
    });

    it('reports an empty list when nothing is stranded', async () => {
      const res = await authed(app, manager)
        .patch(`/api/users/${agent.id}`)
        .send({ isActive: false });

      expect(res.body.orphanedRequests).toEqual([]);
    });
  });
});

describe('POST /api/users/:id/password', () => {
  it('lets a manager reset a password, and the new one works', async () => {
    const res = await authed(app, manager)
      .post(`/api/users/${agent.id}/password`)
      .send({ password: 'ResetPass123' });

    expect(res.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: agent.email, password: 'ResetPass123' });
    expect(login.status).toBe(200);
  });

  it('invalidates the old password', async () => {
    await authed(app, manager)
      .post(`/api/users/${agent.id}/password`)
      .send({ password: 'ResetPass123' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: agent.email, password: 'password123' });

    expect(login.status).toBe(401);
  });

  it('403s a non-manager', async () => {
    const res = await authed(app, agent)
      .post(`/api/users/${employee.id}/password`)
      .send({ password: 'ResetPass123' });

    expect(res.status).toBe(403);
  });

  it('400s a password that is too short', async () => {
    const res = await authed(app, manager)
      .post(`/api/users/${agent.id}/password`)
      .send({ password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('password');
  });

  it('404s an unknown user', async () => {
    const res = await authed(app, manager)
      .post('/api/users/000000000000000000000099/password')
      .send({ password: 'ResetPass123' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/users/:id', () => {
  // The PRD's requester "wants to know who's handling it". Listing users is
  // staff-only, so without this endpoint an employee could never resolve the
  // name of the person working their request.
  it('lets an employee look up the handler assigned to their request', async () => {
    const res = await authed(app, employee).get(`/api/users/${agent.id}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: agent.id, role: UserRole.AGENT });
  });

  it('never returns the password hash', async () => {
    const res = await authed(app, employee).get(`/api/users/${agent.id}`);

    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/users/${agent.id}`);

    expect(res.status).toBe(401);
  });

  it('404s an unknown id', async () => {
    const res = await authed(app, employee).get('/api/users/000000000000000000000099');

    expect(res.status).toBe(404);
  });

  it('404s a malformed id rather than throwing a cast error', async () => {
    const res = await authed(app, employee).get('/api/users/not-an-id');

    expect(res.status).toBe(404);
  });
});
