import { RequestService, type Actor } from '../../../src/application/services/RequestService';
import { RequestCategory } from '../../../src/domain/enums/RequestCategory';
import { RequestPriority } from '../../../src/domain/enums/RequestPriority';
import { RequestStatus } from '../../../src/domain/enums/RequestStatus';
import { UserRole } from '../../../src/domain/enums/UserRole';
import { FakeRequestRepository } from '../../fakes/FakeRequestRepository';
import { FakeUserRepository } from '../../fakes/FakeUserRepository';

const submission = {
  title: 'VPN drops every ten minutes',
  description: 'The VPN client disconnects roughly every ten minutes and has to be restarted.',
  category: RequestCategory.IT,
  priority: RequestPriority.MEDIUM,
};

describe('RequestService assignment', () => {
  let requests: FakeRequestRepository;
  let users: FakeUserRepository;
  let service: RequestService;

  let employee: Actor;
  let agentOne: Actor;
  let agentTwo: Actor;
  let manager: Actor;
  let requestId: string;

  beforeEach(async () => {
    requests = new FakeRequestRepository();
    users = new FakeUserRepository();
    service = new RequestService(requests, users);

    employee = await seedActor(users, UserRole.EMPLOYEE, 'emp@example.com');
    agentOne = await seedActor(users, UserRole.AGENT, 'agent1@example.com');
    agentTwo = await seedActor(users, UserRole.AGENT, 'agent2@example.com');
    manager = await seedActor(users, UserRole.MANAGER, 'manager@example.com');

    const created = await service.createRequest(submission, employee);
    requestId = created.id;
  });

  describe('claimRequest', () => {
    it('gives an unclaimed request to the agent who claims it', async () => {
      const claimed = await service.claimRequest(requestId, agentOne);

      expect(claimed.assigneeId).toBe(agentOne.id);
    });

    it('starts the work, so nothing sits owned but still NEW', async () => {
      const claimed = await service.claimRequest(requestId, agentOne);

      expect(claimed.status).toBe(RequestStatus.IN_PROGRESS);
    });

    it('records the claim in the history', async () => {
      const claimed = await service.claimRequest(requestId, agentOne);
      const last = claimed.history[claimed.history.length - 1];

      expect(last).toMatchObject({
        type: 'ASSIGNED',
        fromStatus: RequestStatus.NEW,
        toStatus: RequestStatus.IN_PROGRESS,
        actorId: agentOne.id,
      });
    });

    it('refuses to take a request another agent already owns', async () => {
      await service.claimRequest(requestId, agentOne);

      await expect(service.claimRequest(requestId, agentTwo)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('is a no-op when the same agent claims twice', async () => {
      await service.claimRequest(requestId, agentOne);
      const again = await service.claimRequest(requestId, agentOne);

      expect(again.assigneeId).toBe(agentOne.id);
      expect(again.history.filter((h) => h.type === 'ASSIGNED')).toHaveLength(1);
    });

    it('will not let an employee claim work', async () => {
      await expect(service.claimRequest(requestId, employee)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('404s an unknown request', async () => {
      await expect(service.claimRequest('000000000000000000000099', agentOne)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('assignRequest', () => {
    it('lets a manager assign an unclaimed request', async () => {
      const assigned = await service.assignRequest(requestId, agentOne.id, manager);

      expect(assigned.assigneeId).toBe(agentOne.id);
      expect(assigned.status).toBe(RequestStatus.IN_PROGRESS);
    });

    it('lets a manager reassign work away from its current owner', async () => {
      await service.claimRequest(requestId, agentOne);

      const reassigned = await service.assignRequest(requestId, agentTwo.id, manager);

      expect(reassigned.assigneeId).toBe(agentTwo.id);
      expect(reassigned.history.filter((h) => h.type === 'ASSIGNED')).toHaveLength(2);
    });

    it('returns a request to the queue when the assignee is null', async () => {
      await service.claimRequest(requestId, agentOne);

      const released = await service.assignRequest(requestId, null, manager);

      expect(released.assigneeId).toBeNull();
      expect(released.history[released.history.length - 1]).toMatchObject({ type: 'UNASSIGNED' });
    });

    it('leaves the status alone when returning a started request to the queue', async () => {
      await service.claimRequest(requestId, agentOne);

      const released = await service.assignRequest(requestId, null, manager);

      expect(released.status).toBe(RequestStatus.IN_PROGRESS);
    });

    it('will not let an agent reassign', async () => {
      await expect(service.assignRequest(requestId, agentTwo.id, agentOne)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('refuses an employee as the owner', async () => {
      await expect(service.assignRequest(requestId, employee.id, manager)).rejects.toMatchObject({
        statusCode: 422,
      });
    });

    it('refuses a user that does not exist', async () => {
      await expect(
        service.assignRequest(requestId, '000000000000000000000099', manager),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('refuses a deactivated handler', async () => {
      users.deactivate('agent2@example.com');

      await expect(service.assignRequest(requestId, agentTwo.id, manager)).rejects.toMatchObject({
        statusCode: 422,
      });
    });
  });

  describe('listMyRequests', () => {
    it('returns only what the caller owns', async () => {
      const second = await service.createRequest(submission, employee);
      await service.claimRequest(requestId, agentOne);
      await service.claimRequest(second.id, agentTwo);

      const mine = await service.listMyRequests(agentOne);

      expect(mine.total).toBe(1);
      expect(mine.items[0]?.id).toBe(requestId);
    });

    it('is empty before anything is claimed', async () => {
      const mine = await service.listMyRequests(agentOne);

      expect(mine.total).toBe(0);
    });

    it('orders the queue by priority, highest first', async () => {
      const low = await service.createRequest(
        { ...submission, priority: RequestPriority.LOW },
        employee,
      );
      const high = await service.createRequest(
        { ...submission, priority: RequestPriority.HIGH },
        employee,
      );
      await service.claimRequest(low.id, agentOne);
      await service.claimRequest(high.id, agentOne);

      const mine = await service.listMyRequests(agentOne);

      expect(mine.items[0]?.priority).toBe(RequestPriority.HIGH);
    });

    it('refuses an employee, who has no queue', async () => {
      await expect(service.listMyRequests(employee)).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});

async function seedActor(users: FakeUserRepository, role: UserRole, email: string): Promise<Actor> {
  const user = await users.create({ email, name: `Test ${role}`, role, passwordHash: 'x' });
  return { id: user.id, role };
}
