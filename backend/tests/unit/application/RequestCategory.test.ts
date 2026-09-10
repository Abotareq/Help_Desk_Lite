import { RequestService, type Actor } from '../../../src/application/services/RequestService';
import { RequestCategory } from '../../../src/domain/enums/RequestCategory';
import { RequestPriority } from '../../../src/domain/enums/RequestPriority';
import { RequestStatus } from '../../../src/domain/enums/RequestStatus';
import { UserRole } from '../../../src/domain/enums/UserRole';
import { FakeRequestRepository } from '../../fakes/FakeRequestRepository';
import { FakeUserRepository } from '../../fakes/FakeUserRepository';

const submission = {
  title: 'The door to the east stairwell will not latch',
  description: 'It swings back open, so the floor is not secure overnight.',
  // Raised as IT because that is where every request seems to start.
  category: RequestCategory.IT,
  priority: RequestPriority.MEDIUM,
};

/**
 * Recategorising is the handler's correction. The rule that carries the weight
 * is who may make it: a relation to this request, not a role in the org.
 */
describe('changing a request category', () => {
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

  /** Raised by the employee, claimed by the agent. */
  async function claimedRequest(): Promise<string> {
    const created = await service.createRequest(submission, employee);
    await service.claimRequest(created.id, agent);
    return created.id;
  }

  describe('who may change it', () => {
    it('lets the assignee correct it', async () => {
      const id = await claimedRequest();

      const updated = await service.changeCategory(id, RequestCategory.FACILITIES, agent);

      expect(updated.category).toBe(RequestCategory.FACILITIES);
    });

    it('lets a manager correct it on any request', async () => {
      const id = await claimedRequest();

      const updated = await service.changeCategory(id, RequestCategory.FACILITIES, manager);

      expect(updated.category).toBe(RequestCategory.FACILITIES);
    });

    // The person who picked the wrong category is not the person who should get
    // to overrule the handler who fixed it.
    it('refuses the requester, who chose the category in the first place', async () => {
      const id = await claimedRequest();

      await expect(
        service.changeCategory(id, RequestCategory.HR, employee),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    // An agent can see an unclaimed request, so a 404 would be a lie they could
    // disprove by loading the queue. Refusing has to say so.
    it('refuses an agent who has not claimed the request', async () => {
      const created = await service.createRequest(submission, employee);

      await expect(
        service.changeCategory(created.id, RequestCategory.HR, otherAgent),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('hides the request entirely from an unrelated employee', async () => {
      const id = await claimedRequest();

      await expect(
        service.changeCategory(id, RequestCategory.HR, bystander),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('404s a request that does not exist', async () => {
      await expect(
        service.changeCategory('does-not-exist', RequestCategory.HR, manager),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('refuses to recategorise a closed request', async () => {
      const created = await service.createRequest(submission, employee);
      await service.updateStatus(created.id, { status: RequestStatus.CLOSED }, employee);

      await expect(
        service.changeCategory(created.id, RequestCategory.HR, manager),
      ).rejects.toMatchObject({ statusCode: 422 });
    });
  });

  describe('what it records', () => {
    it('writes a history entry naming both categories', async () => {
      const id = await claimedRequest();

      await service.changeCategory(id, RequestCategory.FACILITIES, agent);
      const history = await service.getHistory(id, agent);

      expect(history.at(-1)).toMatchObject({
        type: 'CATEGORY_CHANGED',
        fromCategory: RequestCategory.IT,
        toCategory: RequestCategory.FACILITIES,
        actorId: agent.id,
      });
    });

    // The timeline renders every entry the same way. An entry with no status
    // would make it special-case one event type forever.
    it('leaves the status where it was, on the request and in the entry', async () => {
      const id = await claimedRequest();

      const updated = await service.changeCategory(id, RequestCategory.FACILITIES, agent);
      const history = await service.getHistory(id, agent);

      expect(updated.status).toBe(RequestStatus.IN_PROGRESS);
      expect(history.at(-1)).toMatchObject({
        fromStatus: RequestStatus.IN_PROGRESS,
        toStatus: RequestStatus.IN_PROGRESS,
      });
    });

    it('carries no note, so nothing has to be translated out of a sentence', async () => {
      const id = await claimedRequest();

      await service.changeCategory(id, RequestCategory.FACILITIES, agent);
      const history = await service.getHistory(id, agent);

      expect(history.at(-1)?.note).toBeUndefined();
    });

    // Setting a field to what it already holds is not a mistake worth a 422,
    // and a no-op entry would be noise in the one place that must stay readable.
    it('records nothing when the category is already the one asked for', async () => {
      const id = await claimedRequest();
      const before = (await service.getHistory(id, agent)).length;

      const updated = await service.changeCategory(id, RequestCategory.IT, agent);

      expect(updated.category).toBe(RequestCategory.IT);
      expect(await service.getHistory(id, agent)).toHaveLength(before);
    });

    it('keeps every earlier entry, so the trail reads as a sequence of corrections', async () => {
      const id = await claimedRequest();

      await service.changeCategory(id, RequestCategory.FACILITIES, agent);
      await service.changeCategory(id, RequestCategory.HR, manager);

      const changes = (await service.getHistory(id, manager)).filter(
        (h) => h.type === 'CATEGORY_CHANGED',
      );

      expect(changes.map((c) => [c.fromCategory, c.toCategory])).toEqual([
        [RequestCategory.IT, RequestCategory.FACILITIES],
        [RequestCategory.FACILITIES, RequestCategory.HR],
      ]);
    });
  });
});

async function seedActor(users: FakeUserRepository, role: UserRole, email: string): Promise<Actor> {
  const user = await users.create({ email, name: `Test ${role}`, role, passwordHash: 'x' });
  return { id: user.id, role };
}
