import { createApp } from '../../src/app';
import { RequestCategory } from '../../src/domain/enums/RequestCategory';
import { RequestPriority } from '../../src/domain/enums/RequestPriority';
import { RequestStatus } from '../../src/domain/enums/RequestStatus';
import { UserRole } from '../../src/domain/enums/UserRole';
import { authed, createActor, type TestActor } from '../helpers/api';
import { clearTestDb, startTestDb, stopTestDb } from '../setup/testDb';

const app = createApp();

let employee: TestActor;
let agent: TestActor;
let manager: TestActor;
let requestId: string;

const submission = {
  title: 'Payroll portal rejects my login',
  description: 'The payroll portal says my account is locked and the reset email never arrives.',
  category: RequestCategory.HR,
  priority: RequestPriority.HIGH,
};

beforeAll(async () => {
  await startTestDb();
});

beforeEach(async () => {
  employee = await createActor(UserRole.EMPLOYEE);
  agent = await createActor(UserRole.AGENT);
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

function setStatus(actor: TestActor, status: RequestStatus, note?: string) {
  return authed(app, actor)
    .patch(`/api/requests/${requestId}/status`)
    .send(note ? { status, note } : { status });
}

describe('PATCH /api/requests/:id/status', () => {
  it('walks a request from NEW all the way to CLOSED', async () => {
    await authed(app, agent).post(`/api/requests/${requestId}/claim`);

    const waiting = await setStatus(agent, RequestStatus.WAITING, 'Need your employee number');
    expect(waiting.status).toBe(200);
    expect(waiting.body.request.status).toBe(RequestStatus.WAITING);

    const resumed = await setStatus(employee, RequestStatus.IN_PROGRESS, 'Employee number is 4471');
    expect(resumed.body.request.status).toBe(RequestStatus.IN_PROGRESS);

    const resolved = await setStatus(agent, RequestStatus.RESOLVED, 'Account unlocked');
    expect(resolved.body.request.status).toBe(RequestStatus.RESOLVED);
    expect(resolved.body.request.resolvedAt).not.toBeNull();

    const closed = await setStatus(employee, RequestStatus.CLOSED);
    expect(closed.body.request.status).toBe(RequestStatus.CLOSED);
    expect(closed.body.request.closedAt).not.toBeNull();
  });

  it('supports the reopen flow when the fix did not hold', async () => {
    await authed(app, agent).post(`/api/requests/${requestId}/claim`);
    await setStatus(agent, RequestStatus.RESOLVED);

    const reopened = await setStatus(employee, RequestStatus.IN_PROGRESS, 'Still locked out');

    expect(reopened.status).toBe(200);
    expect(reopened.body.request.status).toBe(RequestStatus.IN_PROGRESS);
    expect(reopened.body.request.resolvedAt).toBeNull();
  });

  it('422s an illegal jump and names the legal moves', async () => {
    const res = await setStatus(manager, RequestStatus.RESOLVED);

    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain(RequestStatus.IN_PROGRESS);
  });

  it('403s the requester trying to resolve their own request', async () => {
    await authed(app, agent).post(`/api/requests/${requestId}/claim`);

    const res = await setStatus(employee, RequestStatus.RESOLVED);

    expect(res.status).toBe(403);
  });

  it('treats CLOSED as terminal', async () => {
    await authed(app, agent).post(`/api/requests/${requestId}/claim`);
    await setStatus(agent, RequestStatus.RESOLVED);
    await setStatus(manager, RequestStatus.CLOSED);

    const res = await setStatus(manager, RequestStatus.IN_PROGRESS);

    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain('final');
  });

  it('400s an unknown status value', async () => {
    const res = await authed(app, manager)
      .patch(`/api/requests/${requestId}/status`)
      .send({ status: 'PENDING' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('status');
  });

  it('404s for an employee with no connection to the request', async () => {
    const bystander = await createActor(UserRole.EMPLOYEE);

    const res = await setStatus(bystander, RequestStatus.CLOSED);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/requests/:id/history', () => {
  it('records every hop, oldest first', async () => {
    await authed(app, agent).post(`/api/requests/${requestId}/claim`);
    await setStatus(agent, RequestStatus.RESOLVED);
    await setStatus(employee, RequestStatus.IN_PROGRESS, 'Not fixed');
    await setStatus(agent, RequestStatus.RESOLVED);
    await setStatus(employee, RequestStatus.CLOSED);

    const res = await authed(app, employee).get(`/api/requests/${requestId}/history`);

    expect(res.status).toBe(200);
    expect(res.body.history.map((h: { type: string }) => h.type)).toEqual([
      'CREATED',
      'ASSIGNED',
      'STATUS_CHANGED',
      'REOPENED',
      'STATUS_CHANGED',
      'STATUS_CHANGED',
    ]);
  });

  it('keeps the note against the change it explains', async () => {
    await authed(app, agent).post(`/api/requests/${requestId}/claim`);
    await setStatus(agent, RequestStatus.WAITING, 'Need your employee number');

    const res = await authed(app, employee).get(`/api/requests/${requestId}/history`);
    const waiting = res.body.history.find(
      (h: { toStatus: string }) => h.toStatus === RequestStatus.WAITING,
    );

    expect(waiting.note).toBe('Need your employee number');
  });

  it('404s for an unrelated employee', async () => {
    const bystander = await createActor(UserRole.EMPLOYEE);

    const res = await authed(app, bystander).get(`/api/requests/${requestId}/history`);

    expect(res.status).toBe(404);
  });
});
