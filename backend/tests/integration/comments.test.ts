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
  title: 'Docking station drops the second monitor',
  description: 'The external display goes black whenever the laptop is undocked and docked again.',
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

/** A request raised by the employee and claimed by the agent. */
async function claimedRequest(): Promise<string> {
  const created = await authed(app, employee).post('/api/requests').send(submission);
  const id = created.body.request.id as string;
  await authed(app, agent).post(`/api/requests/${id}/claim`).send();
  return id;
}

describe('POST /api/requests/:id/comments', () => {
  it('posts a comment and returns it', async () => {
    const id = await claimedRequest();

    const res = await authed(app, employee)
      .post(`/api/requests/${id}/comments`)
      .send({ body: 'It happened again this morning' });

    expect(res.status).toBe(201);
    expect(res.body.comment).toMatchObject({
      requestId: id,
      authorId: employee.id,
      body: 'It happened again this morning',
      isInternal: false,
    });
    expect(res.body.comment.id).toEqual(expect.any(String));
  });

  it('requires authentication', async () => {
    const id = await claimedRequest();

    const res = await authed(app, { ...employee, token: 'bad' })
      .post(`/api/requests/${id}/comments`)
      .send({ body: 'Hello' });

    expect(res.status).toBe(401);
  });

  it('rejects an empty comment with a message a person can act on', async () => {
    const id = await claimedRequest();

    const res = await authed(app, employee).post(`/api/requests/${id}/comments`).send({ body: '   ' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('A comment cannot be empty');
  });

  it('rejects a comment past the length limit', async () => {
    const id = await claimedRequest();

    const res = await authed(app, employee)
      .post(`/api/requests/${id}/comments`)
      .send({ body: 'x'.repeat(5001) });

    expect(res.status).toBe(400);
  });

  it('refuses an agent who does not own the request, without hiding it', async () => {
    const created = await authed(app, employee).post('/api/requests').send(submission);
    const id = created.body.request.id as string;

    const res = await authed(app, otherAgent)
      .post(`/api/requests/${id}/comments`)
      .send({ body: 'Passing through' });

    expect(res.status).toBe(403);
  });

  it('gives an unrelated employee a 404 rather than confirming the request exists', async () => {
    const id = await claimedRequest();

    const res = await authed(app, otherEmployee)
      .post(`/api/requests/${id}/comments`)
      .send({ body: 'Nosy' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/requests/:id/comments', () => {
  it('returns the thread oldest first, with a total', async () => {
    const id = await claimedRequest();
    for (const body of ['first', 'second', 'third']) {
      await authed(app, employee).post(`/api/requests/${id}/comments`).send({ body });
    }

    const res = await authed(app, agent).get(`/api/requests/${id}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.comments.map((c: { body: string }) => c.body)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('is empty on a request nobody has commented on', async () => {
    const id = await claimedRequest();

    const res = await authed(app, employee).get(`/api/requests/${id}/comments`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ comments: [], total: 0 });
  });

  it('404s a request the viewer cannot see', async () => {
    const id = await claimedRequest();

    const res = await authed(app, otherEmployee).get(`/api/requests/${id}/comments`);

    expect(res.status).toBe(404);
  });
});

describe('internal notes over the wire', () => {
  async function withInternalNote(): Promise<string> {
    const id = await claimedRequest();
    await authed(app, agent).post(`/api/requests/${id}/comments`).send({ body: 'Looking at it now' });
    await authed(app, agent)
      .post(`/api/requests/${id}/comments`)
      .send({ body: 'Third dock this month, worth escalating', isInternal: true });
    return id;
  }

  it('never reaches the requester', async () => {
    const id = await withInternalNote();

    const res = await authed(app, employee).get(`/api/requests/${id}/comments`);

    expect(res.body.total).toBe(1);
    expect(JSON.stringify(res.body)).not.toContain('worth escalating');
  });

  it('reaches the assignee and a manager', async () => {
    const id = await withInternalNote();

    expect((await authed(app, agent).get(`/api/requests/${id}/comments`)).body.total).toBe(2);
    expect((await authed(app, manager).get(`/api/requests/${id}/comments`)).body.total).toBe(2);
  });

  it('is refused to the requester who tries to write one', async () => {
    const id = await claimedRequest();

    const res = await authed(app, employee)
      .post(`/api/requests/${id}/comments`)
      .send({ body: 'Quietly urgent', isInternal: true });

    expect(res.status).toBe(403);
  });
});

/**
 * A request is returned by half a dozen endpoints, including bulk lists an
 * employee can call. If comments ever start riding along on it, an internal note
 * leaks everywhere at once — so the absence is asserted, not assumed.
 */
describe('comments never ride along on a request payload', () => {
  it('is not on the detail endpoint', async () => {
    const id = await claimedRequest();
    await authed(app, agent)
      .post(`/api/requests/${id}/comments`)
      .send({ body: 'Internal only', isInternal: true });

    const res = await authed(app, employee).get(`/api/requests/${id}`);

    expect(res.body.request).not.toHaveProperty('comments');
    expect(JSON.stringify(res.body)).not.toContain('Internal only');
  });

  it('is not on the list endpoint', async () => {
    const id = await claimedRequest();
    await authed(app, agent)
      .post(`/api/requests/${id}/comments`)
      .send({ body: 'Internal only', isInternal: true });

    const res = await authed(app, employee).get('/api/requests');

    expect(res.body.items[0]).not.toHaveProperty('comments');
    expect(JSON.stringify(res.body)).not.toContain('Internal only');
  });
});

describe('a comment carried by a status change', () => {
  it('moves the request and posts the message in one call', async () => {
    const id = await claimedRequest();

    const res = await authed(app, agent)
      .patch(`/api/requests/${id}/status`)
      .send({
        status: RequestStatus.WAITING,
        comment: { body: 'Could you send us your asset tag?' },
      });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe(RequestStatus.WAITING);

    const thread = await authed(app, employee).get(`/api/requests/${id}/comments`);
    expect(thread.body.comments.map((c: { body: string }) => c.body)).toEqual([
      'Could you send us your asset tag?',
    ]);
  });

  it('rejects a status change carrying an empty comment before anything moves', async () => {
    const id = await claimedRequest();

    const res = await authed(app, agent)
      .patch(`/api/requests/${id}/status`)
      .send({ status: RequestStatus.WAITING, comment: { body: '' } });

    expect(res.status).toBe(400);
    expect((await authed(app, agent).get(`/api/requests/${id}`)).body.request.status).toBe(
      RequestStatus.IN_PROGRESS,
    );
  });
});

/**
 * The record is the point: a thread people can rewrite afterwards is not
 * evidence of what was actually said. There is no route to change one, and this
 * is what would notice if somebody added one.
 */
describe('comments cannot be edited or deleted', () => {
  it('offers no way to change or remove a comment', async () => {
    const id = await claimedRequest();
    const posted = await authed(app, employee)
      .post(`/api/requests/${id}/comments`)
      .send({ body: 'Something I might regret' });
    const commentId = posted.body.comment.id as string;

    const attempts = await Promise.all([
      authed(app, manager).patch(`/api/requests/${id}/comments/${commentId}`).send({ body: 'Edited' }),
      authed(app, manager).put(`/api/requests/${id}/comments/${commentId}`).send({ body: 'Edited' }),
      authed(app, manager).delete(`/api/requests/${id}/comments/${commentId}`).send(),
    ]);

    expect(attempts.map((res) => res.status)).toEqual([404, 404, 404]);

    const thread = await authed(app, manager).get(`/api/requests/${id}/comments`);
    expect(thread.body.comments.map((c: { body: string }) => c.body)).toEqual([
      'Something I might regret',
    ]);
  });
});
