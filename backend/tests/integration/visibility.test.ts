import { createApp } from '../../src/app';
import { RequestCategory } from '../../src/domain/enums/RequestCategory';
import { RequestPriority } from '../../src/domain/enums/RequestPriority';
import { RequestStatus } from '../../src/domain/enums/RequestStatus';
import { UserRole } from '../../src/domain/enums/UserRole';
import { authed, createActor, type TestActor } from '../helpers/api';
import { clearTestDb, startTestDb, stopTestDb } from '../setup/testDb';

const app = createApp();

let employee: TestActor;
let otherEmployee: TestActor;
let agent: TestActor;
let otherAgent: TestActor;
let manager: TestActor;

function submission(
  overrides: Partial<{ category: RequestCategory; priority: RequestPriority }> = {},
) {
  return {
    title: 'Something is broken and needs looking at',
    description: 'A longer description so the validation minimum is comfortably met.',
    category: overrides.category ?? RequestCategory.IT,
    priority: overrides.priority ?? RequestPriority.MEDIUM,
  };
}

beforeAll(async () => {
  await startTestDb();
});

beforeEach(async () => {
  employee = await createActor(UserRole.EMPLOYEE);
  otherEmployee = await createActor(UserRole.EMPLOYEE);
  agent = await createActor(UserRole.AGENT);
  otherAgent = await createActor(UserRole.AGENT);
  manager = await createActor(UserRole.MANAGER);
});

afterEach(async () => {
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

/** Two NEW, one IN_PROGRESS with agent, one RESOLVED, one CLOSED. */
async function seedBoard(): Promise<void> {
  await authed(app, employee).post('/api/requests').send(submission());
  await authed(app, otherEmployee)
    .post('/api/requests')
    .send(submission({ category: RequestCategory.HR }));

  const inProgress = await authed(app, employee)
    .post('/api/requests')
    .send(submission({ priority: RequestPriority.HIGH }));
  await authed(app, agent).post(`/api/requests/${inProgress.body.request.id}/claim`);

  const resolved = await authed(app, employee).post('/api/requests').send(submission());
  await authed(app, otherAgent).post(`/api/requests/${resolved.body.request.id}/claim`);
  await authed(app, otherAgent)
    .patch(`/api/requests/${resolved.body.request.id}/status`)
    .send({ status: RequestStatus.RESOLVED });

  const closed = await authed(app, employee).post('/api/requests').send(submission());
  await authed(app, agent).post(`/api/requests/${closed.body.request.id}/claim`);
  await authed(app, agent)
    .patch(`/api/requests/${closed.body.request.id}/status`)
    .send({ status: RequestStatus.RESOLVED });
  await authed(app, manager)
    .patch(`/api/requests/${closed.body.request.id}/status`)
    .send({ status: RequestStatus.CLOSED });
}

describe('GET /api/requests', () => {
  beforeEach(seedBoard);

  it('gives a manager every request', async () => {
    const res = await authed(app, manager).get('/api/requests');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
  });

  it('gives an employee only what they submitted', async () => {
    const res = await authed(app, otherEmployee).get('/api/requests');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('gives an agent their own work plus the unclaimed queue', async () => {
    const res = await authed(app, agent).get('/api/requests');

    expect(res.status).toBe(200);
    expect(res.body.items.some((r: { assigneeId: string }) => r.assigneeId === otherAgent.id)).toBe(
      false,
    );
  });

  it('will not let an employee widen their scope with a requester filter', async () => {
    const res = await authed(app, otherEmployee).get(`/api/requests?requester=${employee.id}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('filters by status', async () => {
    const res = await authed(app, manager).get(`/api/requests?status=${RequestStatus.NEW}`);

    expect(res.body.total).toBe(2);
  });

  it('accepts several statuses as a comma-separated list', async () => {
    const res = await authed(app, manager).get(
      `/api/requests?status=${RequestStatus.NEW},${RequestStatus.CLOSED}`,
    );

    expect(res.body.total).toBe(3);
  });

  it('accepts a repeated query parameter too', async () => {
    const res = await authed(app, manager).get(
      `/api/requests?status=${RequestStatus.NEW}&status=${RequestStatus.CLOSED}`,
    );

    expect(res.body.total).toBe(3);
  });

  it('filters by owner', async () => {
    const res = await authed(app, manager).get(`/api/requests?assignee=${agent.id}`);

    expect(res.body.total).toBe(2);
  });

  it('filters to the unclaimed backlog', async () => {
    const res = await authed(app, manager).get('/api/requests?assignee=unassigned');

    expect(res.body.total).toBe(2);
  });

  it('filters by category', async () => {
    const res = await authed(app, manager).get(`/api/requests?category=${RequestCategory.HR}`);

    expect(res.body.total).toBe(1);
  });

  it('paginates', async () => {
    const res = await authed(app, manager).get('/api/requests?page=2&limit=2');

    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(2);
  });

  it('sorts by priority, highest first', async () => {
    const res = await authed(app, manager).get('/api/requests?sortBy=priority&sortDir=desc');

    expect(res.body.items[0].priority).toBe(RequestPriority.HIGH);
  });

  it('400s an unknown status filter', async () => {
    const res = await authed(app, manager).get('/api/requests?status=PENDING');

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('status');
  });

  it('400s a malformed assignee filter', async () => {
    const res = await authed(app, manager).get('/api/requests?assignee=nope');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/requests/stats', () => {
  beforeEach(seedBoard);

  it('gives a manager the dashboard counts', async () => {
    const res = await authed(app, manager).get('/api/requests/stats');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.open).toBe(3);
    expect(res.body.unassigned).toBe(2);
  });

  it('breaks the total down by status, zeroes included', async () => {
    const res = await authed(app, manager).get('/api/requests/stats');

    expect(res.body.byStatus).toEqual({
      [RequestStatus.NEW]: 2,
      [RequestStatus.IN_PROGRESS]: 1,
      [RequestStatus.WAITING]: 0,
      [RequestStatus.RESOLVED]: 1,
      [RequestStatus.CLOSED]: 1,
    });
  });

  it('breaks the workload down by owner', async () => {
    const res = await authed(app, manager).get('/api/requests/stats');
    const row = res.body.byAssignee.find((r: { assigneeId: string }) => r.assigneeId === agent.id);

    expect(row.count).toBe(2);
  });

  it('honours the same filters as the list', async () => {
    const res = await authed(app, manager).get(`/api/requests/stats?status=${RequestStatus.NEW}`);

    expect(res.body.total).toBe(2);
  });

  it('scopes an employee to their own requests', async () => {
    const res = await authed(app, otherEmployee).get('/api/requests/stats');

    expect(res.body.total).toBe(1);
  });

  it('is not swallowed by the /:id route', async () => {
    const res = await authed(app, manager).get('/api/requests/stats');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('byStatus');
  });
});
