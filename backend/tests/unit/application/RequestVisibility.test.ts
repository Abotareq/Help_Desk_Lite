import { RequestService, type Actor } from '../../../src/application/services/RequestService';
import { RequestCategory } from '../../../src/domain/enums/RequestCategory';
import { RequestPriority } from '../../../src/domain/enums/RequestPriority';
import { RequestStatus } from '../../../src/domain/enums/RequestStatus';
import { UserRole } from '../../../src/domain/enums/UserRole';
import { FakeRequestRepository } from '../../fakes/FakeRequestRepository';
import { FakeUserRepository } from '../../fakes/FakeUserRepository';

const baseQuery = {
  page: 1,
  limit: 25,
  sortBy: 'createdAt' as const,
  sortDir: 'desc' as const,
};

function submission(overrides: Partial<{ category: RequestCategory; priority: RequestPriority }> = {}) {
  return {
    title: 'Something is broken and needs looking at',
    description: 'A longer description so the validation minimum is comfortably met.',
    category: overrides.category ?? RequestCategory.IT,
    priority: overrides.priority ?? RequestPriority.MEDIUM,
  };
}

describe('RequestService.listRequests', () => {
  let requests: FakeRequestRepository;
  let users: FakeUserRepository;
  let service: RequestService;

  let employee: Actor;
  let otherEmployee: Actor;
  let agent: Actor;
  let otherAgent: Actor;
  let manager: Actor;

  beforeEach(async () => {
    requests = new FakeRequestRepository();
    users = new FakeUserRepository();
    service = new RequestService(requests, users);

    employee = await seedActor(users, UserRole.EMPLOYEE, 'emp@example.com');
    otherEmployee = await seedActor(users, UserRole.EMPLOYEE, 'emp2@example.com');
    agent = await seedActor(users, UserRole.AGENT, 'agent@example.com');
    otherAgent = await seedActor(users, UserRole.AGENT, 'agent2@example.com');
    manager = await seedActor(users, UserRole.MANAGER, 'manager@example.com');
  });

  describe('scoping', () => {
    beforeEach(async () => {
      const mine = await service.createRequest(submission(), employee);
      await service.createRequest(submission(), otherEmployee);
      const claimed = await service.createRequest(submission(), otherEmployee);

      await service.claimRequest(mine.id, agent);
      await service.claimRequest(claimed.id, otherAgent);
    });

    it('shows a manager everything', async () => {
      const result = await service.listRequests(baseQuery, manager);

      expect(result.total).toBe(3);
    });

    it('shows an employee only what they submitted', async () => {
      const result = await service.listRequests(baseQuery, employee);

      expect(result.total).toBe(1);
      expect(result.items.every((r) => r.requesterId === employee.id)).toBe(true);
    });

    it('shows an agent their own work plus the unclaimed queue', async () => {
      const result = await service.listRequests(baseQuery, agent);

      // Their claimed one, plus the one nobody has taken. Not the one the other
      // agent owns.
      expect(result.total).toBe(2);
      expect(result.items.some((r) => r.assigneeId === otherAgent.id)).toBe(false);
    });
  });

  describe('scope cannot be widened by a filter', () => {
    beforeEach(async () => {
      const theirs = await service.createRequest(submission(), otherEmployee);
      await service.claimRequest(theirs.id, otherAgent);
      await service.createRequest(submission(), employee);
    });

    it('an employee filtering by another requester still sees only their own', async () => {
      const result = await service.listRequests(
        { ...baseQuery, requester: otherEmployee.id },
        employee,
      );

      expect(result.total).toBe(0);
    });

    it('an agent filtering by another assignee still sees nothing extra', async () => {
      const result = await service.listRequests({ ...baseQuery, assignee: otherAgent.id }, agent);

      expect(result.total).toBe(0);
    });

    it('a manager filtering by the same assignee does see it', async () => {
      const result = await service.listRequests({ ...baseQuery, assignee: otherAgent.id }, manager);

      expect(result.total).toBe(1);
    });
  });

  describe('filters', () => {
    beforeEach(async () => {
      await service.createRequest(submission({ category: RequestCategory.IT }), employee);
      await service.createRequest(submission({ category: RequestCategory.HR }), employee);
      const high = await service.createRequest(
        submission({ category: RequestCategory.IT, priority: RequestPriority.HIGH }),
        employee,
      );
      await service.claimRequest(high.id, agent);
    });

    it('filters by a single status', async () => {
      const result = await service.listRequests(
        { ...baseQuery, status: [RequestStatus.IN_PROGRESS] },
        manager,
      );

      expect(result.total).toBe(1);
    });

    it('filters by several statuses at once', async () => {
      const result = await service.listRequests(
        { ...baseQuery, status: [RequestStatus.NEW, RequestStatus.IN_PROGRESS] },
        manager,
      );

      expect(result.total).toBe(3);
    });

    it('filters by category', async () => {
      const result = await service.listRequests(
        { ...baseQuery, category: [RequestCategory.IT] },
        manager,
      );

      expect(result.total).toBe(2);
    });

    it('filters by priority', async () => {
      const result = await service.listRequests(
        { ...baseQuery, priority: [RequestPriority.HIGH] },
        manager,
      );

      expect(result.total).toBe(1);
    });

    it('filters to the unclaimed queue', async () => {
      const result = await service.listRequests({ ...baseQuery, assignee: 'unassigned' }, manager);

      expect(result.total).toBe(2);
      expect(result.items.every((r) => r.assigneeId === null)).toBe(true);
    });

    it('combines filters as an AND', async () => {
      const result = await service.listRequests(
        { ...baseQuery, category: [RequestCategory.IT], priority: [RequestPriority.HIGH] },
        manager,
      );

      expect(result.total).toBe(1);
    });

    it('paginates', async () => {
      const result = await service.listRequests({ ...baseQuery, page: 2, limit: 2 }, manager);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(3);
      expect(result.page).toBe(2);
    });

    it('sorts by priority, highest first', async () => {
      const result = await service.listRequests(
        { ...baseQuery, sortBy: 'priority', sortDir: 'desc' },
        manager,
      );

      expect(result.items[0]?.priority).toBe(RequestPriority.HIGH);
    });
  });
});

describe('RequestService.getStats', () => {
  let requests: FakeRequestRepository;
  let users: FakeUserRepository;
  let service: RequestService;

  let employee: Actor;
  let agent: Actor;
  let manager: Actor;

  beforeEach(async () => {
    requests = new FakeRequestRepository();
    users = new FakeUserRepository();
    service = new RequestService(requests, users);

    employee = await seedActor(users, UserRole.EMPLOYEE, 'emp@example.com');
    agent = await seedActor(users, UserRole.AGENT, 'agent@example.com');
    manager = await seedActor(users, UserRole.MANAGER, 'manager@example.com');

    // Two untouched, one in progress, one resolved, one closed.
    await service.createRequest(submission(), employee);
    await service.createRequest(submission(), employee);

    const inProgress = await service.createRequest(submission(), employee);
    await service.claimRequest(inProgress.id, agent);

    const resolved = await service.createRequest(submission(), employee);
    await service.claimRequest(resolved.id, agent);
    await service.updateStatus(resolved.id, { status: RequestStatus.RESOLVED }, agent);

    const closed = await service.createRequest(submission(), employee);
    await service.claimRequest(closed.id, agent);
    await service.updateStatus(closed.id, { status: RequestStatus.RESOLVED }, agent);
    await service.updateStatus(closed.id, { status: RequestStatus.CLOSED }, manager);
  });

  it('counts every request', async () => {
    const stats = await service.getStats({}, manager);

    expect(stats.total).toBe(5);
  });

  it('breaks the total down by status', async () => {
    const stats = await service.getStats({}, manager);

    expect(stats.byStatus).toMatchObject({
      [RequestStatus.NEW]: 2,
      [RequestStatus.IN_PROGRESS]: 1,
      [RequestStatus.WAITING]: 0,
      [RequestStatus.RESOLVED]: 1,
      [RequestStatus.CLOSED]: 1,
    });
  });

  it('includes the zeroes, so dashboard columns do not come and go', async () => {
    const stats = await service.getStats({}, manager);

    expect(Object.keys(stats.byStatus).sort()).toEqual(
      [
        RequestStatus.CLOSED,
        RequestStatus.IN_PROGRESS,
        RequestStatus.NEW,
        RequestStatus.RESOLVED,
        RequestStatus.WAITING,
      ].sort(),
    );
  });

  it('counts open as anything still needing attention', async () => {
    const stats = await service.getStats({}, manager);

    // NEW + IN_PROGRESS + WAITING — not RESOLVED or CLOSED.
    expect(stats.open).toBe(3);
  });

  it('surfaces the unclaimed backlog on its own', async () => {
    const stats = await service.getStats({}, manager);

    expect(stats.unassigned).toBe(2);
  });

  it('breaks the workload down by owner', async () => {
    const stats = await service.getStats({}, manager);
    const agentRow = stats.byAssignee.find((row) => row.assigneeId === agent.id);

    expect(agentRow?.count).toBe(3);
  });

  it('honours the same filters as the list', async () => {
    const stats = await service.getStats({ status: [RequestStatus.NEW] }, manager);

    expect(stats.total).toBe(2);
  });

  it('scopes an employee to their own requests', async () => {
    const otherEmployee = await seedActor(users, UserRole.EMPLOYEE, 'emp2@example.com');
    await service.createRequest(submission(), otherEmployee);

    const stats = await service.getStats({}, otherEmployee);

    expect(stats.total).toBe(1);
  });
});

async function seedActor(users: FakeUserRepository, role: UserRole, email: string): Promise<Actor> {
  const user = await users.create({ email, name: `Test ${role}`, role, passwordHash: 'x' });
  return { id: user.id, role };
}
