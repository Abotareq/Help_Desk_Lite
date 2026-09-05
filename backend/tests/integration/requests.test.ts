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
let manager: TestActor;

const submission = {
  title: 'Monitor flickers on the left desk',
  description: 'The second monitor at desk 14 flickers every few minutes and then goes black.',
  category: RequestCategory.FACILITIES,
  priority: RequestPriority.LOW,
};

beforeAll(async () => {
  await startTestDb();
});
beforeEach(async () => {
  employee = await createActor(UserRole.EMPLOYEE);
  otherEmployee = await createActor(UserRole.EMPLOYEE);
  agent = await createActor(UserRole.AGENT);
  manager = await createActor(UserRole.MANAGER);
});
afterEach(async () => {
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

describe('POST /api/requests', () => {
  it('creates a request and returns it with a reference and NEW status', async () => {
    const res = await authed(app, employee).post('/api/requests').send(submission);

    expect(res.status).toBe(201);
    expect(res.body.request.reference).toMatch(/^HD-\d{6}$/);
    expect(res.body.request.status).toBe(RequestStatus.NEW);
    expect(res.body.request.assigneeId).toBeNull();
    expect(res.body.request.requesterId).toBe(employee.id);
    expect(res.body.request.history).toHaveLength(1);
  });

  it('requires authentication', async () => {
    const res = await authed(app, { ...employee, token: 'bad' })
      .post('/api/requests')
      .send(submission);

    expect(res.status).toBe(401);
  });

  it('rejects a missing title and description with field-level detail', async () => {
    const res = await authed(app, employee)
      .post('/api/requests')
      .send({ category: RequestCategory.IT });

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'description']));
  });

  it('rejects a category outside the allowed set', async () => {
    const res = await authed(app, employee)
      .post('/api/requests')
      .send({ ...submission, category: 'LEGAL' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('category');
  });

  it('defaults priority to MEDIUM when it is left off', async () => {
    const { priority: _omitted, ...withoutPriority } = submission;

    const res = await authed(app, employee).post('/api/requests').send(withoutPriority);

    expect(res.status).toBe(201);
    expect(res.body.request.priority).toBe(RequestPriority.MEDIUM);
  });

  it('hands out sequential references across submitters', async () => {
    const first = await authed(app, employee).post('/api/requests').send(submission);
    const second = await authed(app, otherEmployee).post('/api/requests').send(submission);

    const firstSeq = Number(first.body.request.reference.split('-')[1]);
    const secondSeq = Number(second.body.request.reference.split('-')[1]);
    expect(secondSeq).toBe(firstSeq + 1);
  });
});

describe('GET /api/requests/:id', () => {
  let requestId: string;

  beforeEach(async () => {
    const res = await authed(app, employee).post('/api/requests').send(submission);
    requestId = res.body.request.id;
  });

  it('returns the request to its requester', async () => {
    const res = await authed(app, employee).get(`/api/requests/${requestId}`);

    expect(res.status).toBe(200);
    expect(res.body.request.id).toBe(requestId);
  });

  it('returns the request to a manager', async () => {
    const res = await authed(app, manager).get(`/api/requests/${requestId}`);

    expect(res.status).toBe(200);
  });

  it('returns an unassigned request to an agent', async () => {
    const res = await authed(app, agent).get(`/api/requests/${requestId}`);

    expect(res.status).toBe(200);
  });

  it('404s the request for an unrelated employee', async () => {
    const res = await authed(app, otherEmployee).get(`/api/requests/${requestId}`);

    expect(res.status).toBe(404);
  });

  it('404s a malformed id rather than throwing a cast error', async () => {
    const res = await authed(app, manager).get('/api/requests/not-an-id');

    expect(res.status).toBe(404);
  });
});
