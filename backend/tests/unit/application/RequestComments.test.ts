import { RequestService, type Actor } from '../../../src/application/services/RequestService';
import { RequestCategory } from '../../../src/domain/enums/RequestCategory';
import { RequestPriority } from '../../../src/domain/enums/RequestPriority';
import { RequestStatus } from '../../../src/domain/enums/RequestStatus';
import { UserRole } from '../../../src/domain/enums/UserRole';
import { FakeRequestRepository } from '../../fakes/FakeRequestRepository';
import { FakeUserRepository } from '../../fakes/FakeUserRepository';

const submission = {
  title: 'VPN drops every few minutes',
  description: 'The connection dies roughly every five minutes and has to be dialled again.',
  category: RequestCategory.IT,
  priority: RequestPriority.HIGH,
};

/**
 * The conversation on a request. Two rules carry the weight here: who is allowed
 * to speak (a relation, not a role) and who is allowed to hear an internal note.
 * Everything else is bookkeeping.
 */
describe('comments on a request', () => {
  let requests: FakeRequestRepository;
  let users: FakeUserRepository;
  let service: RequestService;

  let employee: Actor;
  let bystander: Actor;
  let agent: Actor;
  let otherAgent: Actor;
  let manager: Actor;

  beforeEach(async () => {
    requests = new FakeRequestRepository();
    users = new FakeUserRepository();
    service = new RequestService(requests, users);

    employee = await seedActor(users, UserRole.EMPLOYEE, 'emp@example.com');
    bystander = await seedActor(users, UserRole.EMPLOYEE, 'bystander@example.com');
    agent = await seedActor(users, UserRole.AGENT, 'agent@example.com');
    otherAgent = await seedActor(users, UserRole.AGENT, 'other-agent@example.com');
    manager = await seedActor(users, UserRole.MANAGER, 'manager@example.com');
  });

  /** A request raised by the employee and claimed by the agent. */
  async function claimedRequest(): Promise<string> {
    const created = await service.createRequest(submission, employee);
    await service.claimRequest(created.id, agent);
    return created.id;
  }

  describe('who may post', () => {
    it('lets the requester post', async () => {
      const id = await claimedRequest();

      const comment = await service.addComment(
        id,
        { body: 'Still happening', isInternal: false },
        employee,
      );

      expect(comment).toMatchObject({
        authorId: employee.id,
        body: 'Still happening',
        requestId: id,
      });
    });

    it('lets the assignee post', async () => {
      const id = await claimedRequest();

      const comment = await service.addComment(
        id,
        { body: 'What is your asset tag?', isInternal: false },
        agent,
      );

      expect(comment.authorId).toBe(agent.id);
    });

    it('lets a manager post on any request', async () => {
      const id = await claimedRequest();

      const comment = await service.addComment(
        id,
        { body: 'Escalating this', isInternal: false },
        manager,
      );

      expect(comment.authorId).toBe(manager.id);
    });

    // An agent can see an unclaimed request, so refusing the post has to be a
    // 403 and not a 404 — pretending it does not exist would be a lie they can
    // disprove by loading the queue.
    it('refuses an agent who has not claimed the request', async () => {
      const created = await service.createRequest(submission, employee);

      await expect(
        service.addComment(
          created.id,
          { body: 'Just passing through', isInternal: false },
          otherAgent,
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('hides the request entirely from an unrelated employee', async () => {
      const id = await claimedRequest();

      await expect(
        service.addComment(id, { body: 'Nosy', isInternal: false }, bystander),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('refuses a comment on a closed request', async () => {
      const created = await service.createRequest(submission, employee);
      await service.updateStatus(created.id, { status: RequestStatus.CLOSED }, employee);

      await expect(
        service.addComment(created.id, { body: 'One more thing', isInternal: false }, employee),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('refuses a comment on a request that does not exist', async () => {
      await expect(
        service.addComment('does-not-exist', { body: 'Hello', isInternal: false }, manager),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('reading the thread', () => {
    it('returns comments oldest first', async () => {
      const id = await claimedRequest();
      await service.addComment(id, { body: 'first', isInternal: false }, employee);
      await service.addComment(id, { body: 'second', isInternal: false }, agent);
      await service.addComment(id, { body: 'third', isInternal: false }, employee);

      const thread = await service.listComments(id, manager);

      expect(thread.map((c) => c.body)).toEqual(['first', 'second', 'third']);
    });

    it('lets an agent read the thread on an unclaimed request they can see', async () => {
      const created = await service.createRequest(submission, employee);
      await service.addComment(created.id, { body: 'Any update?', isInternal: false }, employee);

      const thread = await service.listComments(created.id, otherAgent);

      expect(thread.map((c) => c.body)).toEqual(['Any update?']);
    });

    it('refuses the thread to someone who cannot see the request', async () => {
      const id = await claimedRequest();

      await expect(service.listComments(id, bystander)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('starts empty rather than failing', async () => {
      const id = await claimedRequest();

      await expect(service.listComments(id, employee)).resolves.toEqual([]);
    });
  });

  describe('internal notes', () => {
    async function withInternalNote(): Promise<string> {
      const id = await claimedRequest();
      await service.addComment(id, { body: 'Visible to all', isInternal: false }, agent);
      await service.addComment(id, { body: 'Third time this month', isInternal: true }, agent);
      return id;
    }

    it('keeps an internal note away from the requester', async () => {
      const id = await withInternalNote();

      const thread = await service.listComments(id, employee);

      expect(thread.map((c) => c.body)).toEqual(['Visible to all']);
    });

    it('shows it to the assignee', async () => {
      const id = await withInternalNote();

      const thread = await service.listComments(id, agent);

      expect(thread.map((c) => c.body)).toEqual(['Visible to all', 'Third time this month']);
    });

    it('shows it to a manager', async () => {
      const id = await withInternalNote();

      expect(await service.listComments(id, manager)).toHaveLength(2);
    });

    it('keeps it from an agent who does not own the request', async () => {
      const created = await service.createRequest(submission, employee);
      await service.addComment(
        created.id,
        { body: 'Looks like a driver', isInternal: true },
        manager,
      );

      const thread = await service.listComments(created.id, otherAgent);

      expect(thread).toEqual([]);
    });

    // The requester of a request is the requester whatever their role. An agent
    // who raised a ticket about their own laptop is not a handler of it.
    it('keeps it from an agent reading a request they raised themselves', async () => {
      const created = await service.createRequest(submission, agent);
      await service.assignRequest(created.id, otherAgent.id, manager);
      await service.addComment(
        created.id,
        { body: 'They always do this', isInternal: true },
        otherAgent,
      );

      const thread = await service.listComments(created.id, agent);

      expect(thread).toEqual([]);
    });

    it('refuses to let the requester write one', async () => {
      const id = await claimedRequest();

      await expect(
        service.addComment(id, { body: 'Secretly urgent', isInternal: true }, employee),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('does not store a refused internal note at all', async () => {
      const id = await claimedRequest();

      await expect(
        service.addComment(id, { body: 'Secretly urgent', isInternal: true }, employee),
      ).rejects.toThrow();

      expect(await service.listComments(id, manager)).toEqual([]);
    });
  });

  describe('a comment carried by a status change', () => {
    /** Claimed, then put on hold — so the requester has a legal move of their own. */
    async function waitingRequest(): Promise<string> {
      const id = await claimedRequest();
      await service.updateStatus(id, { status: RequestStatus.WAITING }, agent);
      return id;
    }

    it('posts the message and makes the move in one call', async () => {
      const id = await claimedRequest();

      const updated = await service.updateStatus(
        id,
        {
          status: RequestStatus.WAITING,
          comment: { body: 'Send us your asset tag', isInternal: false },
        },
        agent,
      );

      expect(updated.status).toBe(RequestStatus.WAITING);
      expect((await service.listComments(id, employee)).map((c) => c.body)).toEqual([
        'Send us your asset tag',
      ]);
    });

    it('lets the requester answer and resume in one call', async () => {
      const id = await waitingRequest();

      const updated = await service.updateStatus(
        id,
        {
          status: RequestStatus.IN_PROGRESS,
          comment: { body: 'The tag is BK-4471', isInternal: false },
        },
        employee,
      );

      expect(updated.status).toBe(RequestStatus.IN_PROGRESS);
      expect((await service.listComments(id, agent)).map((c) => c.body)).toEqual([
        'The tag is BK-4471',
      ]);
    });

    // The move on its own is legal for the requester — answering is what
    // unblocks a waiting request. Only the comment is not, so this is the case
    // that proves the comment is checked before anything moves rather than
    // being waved through on the strength of the transition.
    it('leaves the request where it was when only the comment is refused', async () => {
      const id = await waitingRequest();

      await expect(
        service.updateStatus(
          id,
          { status: RequestStatus.IN_PROGRESS, comment: { body: 'Sneaky', isInternal: true } },
          employee,
        ),
      ).rejects.toMatchObject({ statusCode: 403 });

      const request = await service.getRequestById(id, manager);
      expect(request.status).toBe(RequestStatus.WAITING);
      expect(await service.listComments(id, manager)).toEqual([]);
    });

    it('still refuses an illegal move that arrives with a comment', async () => {
      const created = await service.createRequest(submission, employee);

      await expect(
        service.updateStatus(
          created.id,
          { status: RequestStatus.RESOLVED, comment: { body: 'Done', isInternal: false } },
          manager,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });

      expect(await service.listComments(created.id, manager)).toEqual([]);
    });

    it('puts the note on the history and the comment on the thread, not both in one place', async () => {
      const id = await claimedRequest();

      await service.updateStatus(
        id,
        {
          status: RequestStatus.WAITING,
          note: 'Blocked on hardware details',
          comment: { body: 'Could you send your asset tag?', isInternal: false },
        },
        agent,
      );

      const history = await service.getHistory(id, agent);
      expect(history.at(-1)).toMatchObject({ note: 'Blocked on hardware details' });
      expect((await service.listComments(id, agent)).map((c) => c.body)).toEqual([
        'Could you send your asset tag?',
      ]);
    });

    it('lets a handler attach an internal note to a move', async () => {
      const id = await claimedRequest();

      await service.updateStatus(
        id,
        {
          status: RequestStatus.RESOLVED,
          comment: { body: 'Swapped the dock, no need to say so', isInternal: true },
        },
        agent,
      );

      expect(await service.listComments(id, employee)).toEqual([]);
      expect(await service.listComments(id, agent)).toHaveLength(1);
    });
  });
});

async function seedActor(users: FakeUserRepository, role: UserRole, email: string): Promise<Actor> {
  const user = await users.create({ email, name: `Test ${role}`, role, passwordHash: 'x' });
  return { id: user.id, role };
}
