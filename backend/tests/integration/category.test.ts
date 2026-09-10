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

const submission = {
  title: 'The door to the east stairwell will not latch',
  description: 'It swings back open, so the floor is not secure overnight.',
  category: RequestCategory.IT,
  priority: RequestPriority.MEDIUM,
};

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

async function claimedRequest(): Promise<string> {
  const created = await authed(app, employee).post('/api/requests').send(submission);
  const id = created.body.request.id as string;
  await authed(app, agent).post(`/api/requests/${id}/claim`).send();
  return id;
}

describe('PATCH /api/requests/:id/category', () => {
  it('recategorises the request and returns it', async () => {
    const id = await claimedRequest();

    const res = await authed(app, agent)
      .patch(`/api/requests/${id}/category`)
      .send({ category: RequestCategory.FACILITIES });

    expect(res.status).toBe(200);
    expect(res.body.request.category).toBe(RequestCategory.FACILITIES);
  });

  it('requires authentication', async () => {
    const id = await claimedRequest();

    const res = await authed(app, { ...agent, token: 'bad' })
      .patch(`/api/requests/${id}/category`)
      .send({ category: RequestCategory.FACILITIES });

    expect(res.status).toBe(401);
  });

  it('rejects a category outside the fixed list, naming the ones that exist', async () => {
    const id = await claimedRequest();

    const res = await authed(app, agent)
      .patch(`/api/requests/${id}/category`)
      .send({ category: 'PLUMBING' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('Category must be one of');
  });

  it('rejects a missing category', async () => {
    const id = await claimedRequest();

    const res = await authed(app, agent).patch(`/api/requests/${id}/category`).send({});

    expect(res.status).toBe(400);
  });

  it('lets a manager recategorise a request they do not own', async () => {
    const id = await claimedRequest();

    const res = await authed(app, manager)
      .patch(`/api/requests/${id}/category`)
      .send({ category: RequestCategory.HR });

    expect(res.status).toBe(200);
    expect(res.body.request.category).toBe(RequestCategory.HR);
  });

  it('refuses the requester', async () => {
    const id = await claimedRequest();

    const res = await authed(app, employee)
      .patch(`/api/requests/${id}/category`)
      .send({ category: RequestCategory.HR });

    expect(res.status).toBe(403);
  });

  it('refuses an agent who has not claimed it, rather than pretending it is missing', async () => {
    const created = await authed(app, employee).post('/api/requests').send(submission);
    const id = created.body.request.id as string;

    const res = await authed(app, otherAgent)
      .patch(`/api/requests/${id}/category`)
      .send({ category: RequestCategory.HR });

    expect(res.status).toBe(403);
  });

  it('404s for someone who cannot see the request at all', async () => {
    const id = await claimedRequest();

    const res = await authed(app, otherEmployee)
      .patch(`/api/requests/${id}/category`)
      .send({ category: RequestCategory.HR });

    expect(res.status).toBe(404);
  });

  it('refuses to recategorise a closed request', async () => {
    const created = await authed(app, employee).post('/api/requests').send(submission);
    const id = created.body.request.id as string;
    await authed(app, employee)
      .patch(`/api/requests/${id}/status`)
      .send({ status: RequestStatus.CLOSED });

    const res = await authed(app, manager)
      .patch(`/api/requests/${id}/category`)
      .send({ category: RequestCategory.HR });

    expect(res.status).toBe(422);
  });

  it('shows up on the history endpoint with both categories', async () => {
    const id = await claimedRequest();
    await authed(app, agent)
      .patch(`/api/requests/${id}/category`)
      .send({ category: RequestCategory.FACILITIES });

    const res = await authed(app, employee).get(`/api/requests/${id}/history`);
    const entry = res.body.history.at(-1);

    expect(entry).toMatchObject({
      type: 'CATEGORY_CHANGED',
      fromCategory: RequestCategory.IT,
      toCategory: RequestCategory.FACILITIES,
    });
  });

  // The requester cannot make the change, but they can certainly see it — the
  // category on their own request just moved.
  it('is visible to the requester on their own request', async () => {
    const id = await claimedRequest();
    await authed(app, agent)
      .patch(`/api/requests/${id}/category`)
      .send({ category: RequestCategory.FACILITIES });

    const res = await authed(app, employee).get(`/api/requests/${id}`);

    expect(res.body.request.category).toBe(RequestCategory.FACILITIES);
  });

  it('survives the round trip to Mongo rather than only living in the response', async () => {
    const id = await claimedRequest();
    await authed(app, agent)
      .patch(`/api/requests/${id}/category`)
      .send({ category: RequestCategory.OTHER });

    const reloaded = await authed(app, manager).get(`/api/requests/${id}`);

    expect(reloaded.body.request.category).toBe(RequestCategory.OTHER);
  });
});
