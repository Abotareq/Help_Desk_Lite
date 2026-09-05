import { createApp } from '../../src/app';
import { RequestCategory } from '../../src/domain/enums/RequestCategory';
import { RequestPriority } from '../../src/domain/enums/RequestPriority';
import { RequestStatus } from '../../src/domain/enums/RequestStatus';
import { UserRole } from '../../src/domain/enums/UserRole';
import { authed, createActor, type TestActor } from '../helpers/api';
import { clearTestDb, startTestDb, stopTestDb } from '../setup/testDb';

const app = createApp();

let employee: TestActor;
let agentOne: TestActor;
let agentTwo: TestActor;
let manager: TestActor;
let requestId: string;

const submission = {
  title: 'Badge reader rejects my card',
  description: 'My badge stopped opening the third floor door on Monday morning.',
  category: RequestCategory.FACILITIES,
  priority: RequestPriority.MEDIUM,
};

beforeAll(async () => {
  await startTestDb();
});

beforeEach(async () => {
  employee = await createActor(UserRole.EMPLOYEE);
  agentOne = await createActor(UserRole.AGENT);
  agentTwo = await createActor(UserRole.AGENT);
  manager = await createActor(UserRole.MANAGER);

  const created = await authed(app, employee).post('/api/requests').send(submission);
  requestId = created.body.request.id;
});

afterEach(async () => {
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

describe('POST /api/requests/:id/claim', () => {
  it('assigns the request to the claiming agent and starts it', async () => {
    const res = await authed(app, agentOne).post(`/api/requests/${requestId}/claim`);

    expect(res.status).toBe(200);
    expect(res.body.request.assigneeId).toBe(agentOne.id);
    expect(res.body.request.status).toBe(RequestStatus.IN_PROGRESS);
  });

  it('409s when another agent already owns it', async () => {
    await authed(app, agentOne).post(`/api/requests/${requestId}/claim`);

    const res = await authed(app, agentTwo).post(`/api/requests/${requestId}/claim`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('403s an employee', async () => {
    const res = await authed(app, employee).post(`/api/requests/${requestId}/claim`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/requests/:id/assign', () => {
  it('lets a manager assign to an agent', async () => {
    const res = await authed(app, manager)
      .patch(`/api/requests/${requestId}/assign`)
      .send({ assigneeId: agentOne.id });

    expect(res.status).toBe(200);
    expect(res.body.request.assigneeId).toBe(agentOne.id);
  });

  it('lets a manager reassign away from the current owner', async () => {
    await authed(app, agentOne).post(`/api/requests/${requestId}/claim`);

    const res = await authed(app, manager)
      .patch(`/api/requests/${requestId}/assign`)
      .send({ assigneeId: agentTwo.id });

    expect(res.status).toBe(200);
    expect(res.body.request.assigneeId).toBe(agentTwo.id);
  });

  it('returns the request to the queue when assigneeId is null', async () => {
    await authed(app, agentOne).post(`/api/requests/${requestId}/claim`);

    const res = await authed(app, manager)
      .patch(`/api/requests/${requestId}/assign`)
      .send({ assigneeId: null });

    expect(res.status).toBe(200);
    expect(res.body.request.assigneeId).toBeNull();
  });

  it('403s an agent trying to reassign', async () => {
    const res = await authed(app, agentOne)
      .patch(`/api/requests/${requestId}/assign`)
      .send({ assigneeId: agentTwo.id });

    expect(res.status).toBe(403);
  });

  it('422s when the target is an employee', async () => {
    const res = await authed(app, manager)
      .patch(`/api/requests/${requestId}/assign`)
      .send({ assigneeId: employee.id });

    expect(res.status).toBe(422);
  });

  it('400s a malformed assigneeId', async () => {
    const res = await authed(app, manager)
      .patch(`/api/requests/${requestId}/assign`)
      .send({ assigneeId: 'nope' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('assigneeId');
  });
});

describe('GET /api/requests/mine', () => {
  it('lists what the agent has claimed, and nothing else', async () => {
    const other = await authed(app, employee).post('/api/requests').send(submission);
    await authed(app, agentOne).post(`/api/requests/${requestId}/claim`);
    await authed(app, agentTwo).post(`/api/requests/${other.body.request.id}/claim`);

    const res = await authed(app, agentOne).get('/api/requests/mine');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(requestId);
  });

  it('is not swallowed by the /:id route', async () => {
    const res = await authed(app, agentOne).get('/api/requests/mine');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
  });

  it('403s an employee', async () => {
    const res = await authed(app, employee).get('/api/requests/mine');

    expect(res.status).toBe(403);
  });

  it('paginates', async () => {
    for (let i = 0; i < 3; i += 1) {
      const created = await authed(app, employee).post('/api/requests').send(submission);
      await authed(app, agentOne).post(`/api/requests/${created.body.request.id}/claim`);
    }

    const res = await authed(app, agentOne).get('/api/requests/mine?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.limit).toBe(2);
  });
});
