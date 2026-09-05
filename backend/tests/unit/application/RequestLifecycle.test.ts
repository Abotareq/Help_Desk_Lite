import { RequestService, type Actor } from '../../../src/application/services/RequestService';
import { RequestCategory } from '../../../src/domain/enums/RequestCategory';
import { RequestPriority } from '../../../src/domain/enums/RequestPriority';
import { REQUEST_STATUSES, RequestStatus } from '../../../src/domain/enums/RequestStatus';
import { UserRole } from '../../../src/domain/enums/UserRole';
import { TRANSITIONS, nextStatuses } from '../../../src/domain/workflow/transitions';
import { FakeRequestRepository } from '../../fakes/FakeRequestRepository';
import { FakeUserRepository } from '../../fakes/FakeUserRepository';

const submission = {
  title: 'Printer on floor two jams constantly',
  description: 'Every third print job jams and has to be cleared by hand.',
  category: RequestCategory.IT,
  priority: RequestPriority.MEDIUM,
};

/** Every from/to pair, so the table below is exhaustive by construction. */
const ALL_PAIRS = REQUEST_STATUSES.flatMap((from) =>
  REQUEST_STATUSES.filter((to) => to !== from).map((to) => ({ from, to })),
);

const LEGAL = new Set(TRANSITIONS.map((t) => `${t.from}->${t.to}`));

describe('the workflow transition table', () => {
  it('makes CLOSED terminal', () => {
    expect(nextStatuses(RequestStatus.CLOSED)).toEqual([]);
  });

  it('leaves every other state with somewhere to go', () => {
    for (const status of REQUEST_STATUSES) {
      if (status === RequestStatus.CLOSED) continue;
      expect(nextStatuses(status).length).toBeGreaterThan(0);
    }
  });

  it('marks exactly one move as a reopen', () => {
    const reopens = TRANSITIONS.filter((t) => t.isReopen);

    expect(reopens).toHaveLength(1);
    expect(reopens[0]).toMatchObject({
      from: RequestStatus.RESOLVED,
      to: RequestStatus.IN_PROGRESS,
    });
  });

  it('reaches every state from NEW', () => {
    const reachable = new Set<RequestStatus>([RequestStatus.NEW]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of TRANSITIONS) {
        if (reachable.has(t.from) && !reachable.has(t.to)) {
          reachable.add(t.to);
          grew = true;
        }
      }
    }

    expect([...reachable].sort()).toEqual([...REQUEST_STATUSES].sort());
  });
});

describe('RequestService.updateStatus', () => {
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
    otherAgent = await seedActor(users, UserRole.AGENT, 'agent2@example.com');
    manager = await seedActor(users, UserRole.MANAGER, 'manager@example.com');
  });

  /**
   * Drives a request to `target` using the manager, who holds every relation,
   * so each case starts from the state it actually wants to test.
   */
  async function requestIn(target: RequestStatus, assignee: Actor | null = agent): Promise<string> {
    const created = await service.createRequest(submission, employee);
    if (assignee) await service.assignRequest(created.id, assignee.id, manager);

    const route: Partial<Record<RequestStatus, RequestStatus[]>> = {
      [RequestStatus.NEW]: [],
      [RequestStatus.IN_PROGRESS]: [],
      [RequestStatus.WAITING]: [RequestStatus.WAITING],
      [RequestStatus.RESOLVED]: [RequestStatus.RESOLVED],
      [RequestStatus.CLOSED]: [RequestStatus.RESOLVED, RequestStatus.CLOSED],
    };

    for (const step of route[target] ?? []) {
      await service.updateStatus(created.id, { status: step }, manager);
    }

    // NEW is only reachable by never assigning in the first place.
    if (target === RequestStatus.NEW && assignee) {
      throw new Error('A NEW request cannot have an assignee');
    }

    return created.id;
  }

  describe('legality, exhaustively', () => {
    it.each(ALL_PAIRS)('$from -> $to matches the table', async ({ from, to }) => {
      const shouldPass = LEGAL.has(`${from}->${to}`);
      const id = await requestIn(from, from === RequestStatus.NEW ? null : agent);

      const outcome = await service
        .updateStatus(id, { status: to }, manager)
        .then(() => 'allowed' as const)
        .catch(() => 'refused' as const);

      expect(outcome).toBe(shouldPass ? 'allowed' : 'refused');
    });
  });

  describe('who may move a request', () => {
    it('lets the assignee resolve their own work', async () => {
      const id = await requestIn(RequestStatus.IN_PROGRESS);

      const updated = await service.updateStatus(id, { status: RequestStatus.RESOLVED }, agent);

      expect(updated.status).toBe(RequestStatus.RESOLVED);
    });

    it('stops an agent moving a request owned by someone else', async () => {
      const id = await requestIn(RequestStatus.IN_PROGRESS);

      // 404 rather than 403: an agent cannot see another agent's assigned work
      // at all, so the visibility check refuses it before the transition rules
      // are ever consulted.
      await expect(
        service.updateStatus(id, { status: RequestStatus.RESOLVED }, otherAgent),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('stops an agent moving an unassigned request they can see but do not own', async () => {
      const created = await service.createRequest(submission, employee);
      await service.updateStatus(created.id, { status: RequestStatus.IN_PROGRESS }, manager);
      await service.assignRequest(created.id, null, manager);

      await expect(
        service.updateStatus(created.id, { status: RequestStatus.RESOLVED }, otherAgent),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('stops the requester resolving their own request', async () => {
      const id = await requestIn(RequestStatus.IN_PROGRESS);

      await expect(
        service.updateStatus(id, { status: RequestStatus.RESOLVED }, employee),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('lets the requester resume a request that is waiting on them', async () => {
      const id = await requestIn(RequestStatus.WAITING);

      const updated = await service.updateStatus(id, { status: RequestStatus.IN_PROGRESS }, employee);

      expect(updated.status).toBe(RequestStatus.IN_PROGRESS);
    });

    it('lets a manager move anything', async () => {
      const id = await requestIn(RequestStatus.IN_PROGRESS);

      await expect(
        service.updateStatus(id, { status: RequestStatus.RESOLVED }, manager),
      ).resolves.toMatchObject({ status: RequestStatus.RESOLVED });
    });

    it('hides an unrelated request behind a 404 instead of a 403', async () => {
      const id = await requestIn(RequestStatus.IN_PROGRESS);

      await expect(
        service.updateStatus(id, { status: RequestStatus.RESOLVED }, bystander),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('rejections', () => {
    it('refuses a move to the status it is already in', async () => {
      const id = await requestIn(RequestStatus.IN_PROGRESS);

      await expect(
        service.updateStatus(id, { status: RequestStatus.IN_PROGRESS }, manager),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('says what CLOSED means rather than just refusing', async () => {
      const id = await requestIn(RequestStatus.CLOSED);

      await expect(
        service.updateStatus(id, { status: RequestStatus.IN_PROGRESS }, manager),
      ).rejects.toMatchObject({ message: expect.stringContaining('final') });
    });

    it('lists the legal moves when an illegal one is attempted', async () => {
      const id = await requestIn(RequestStatus.NEW, null);

      await expect(
        service.updateStatus(id, { status: RequestStatus.RESOLVED }, manager),
      ).rejects.toMatchObject({ message: expect.stringContaining(RequestStatus.IN_PROGRESS) });
    });

    it('404s an unknown request', async () => {
      await expect(
        service.updateStatus('000000000000000000000099', { status: RequestStatus.CLOSED }, manager),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('the reopen flow', () => {
    it('lets the requester reopen when the fix did not hold', async () => {
      const id = await requestIn(RequestStatus.RESOLVED);

      const reopened = await service.updateStatus(
        id,
        { status: RequestStatus.IN_PROGRESS, note: 'Still jamming this morning' },
        employee,
      );

      expect(reopened.status).toBe(RequestStatus.IN_PROGRESS);
    });

    it('records it as a REOPENED event, not a plain status change', async () => {
      const id = await requestIn(RequestStatus.RESOLVED);

      const reopened = await service.updateStatus(id, { status: RequestStatus.IN_PROGRESS }, employee);
      const last = reopened.history[reopened.history.length - 1];

      expect(last?.type).toBe('REOPENED');
    });

    it('clears resolvedAt, so it never means "was resolved once"', async () => {
      const id = await requestIn(RequestStatus.RESOLVED);
      const resolved = await service.getRequestById(id, manager);
      expect(resolved.resolvedAt).not.toBeNull();

      const reopened = await service.updateStatus(id, { status: RequestStatus.IN_PROGRESS }, employee);

      expect(reopened.resolvedAt).toBeNull();
    });

    it('keeps the owner, so reopening does not drop it back on the queue', async () => {
      const id = await requestIn(RequestStatus.RESOLVED);

      const reopened = await service.updateStatus(id, { status: RequestStatus.IN_PROGRESS }, employee);

      expect(reopened.assigneeId).toBe(agent.id);
    });
  });

  describe('timestamps and history', () => {
    it('stamps resolvedAt and closedAt as it passes through', async () => {
      const id = await requestIn(RequestStatus.RESOLVED);
      const closed = await service.updateStatus(id, { status: RequestStatus.CLOSED }, manager);

      expect(closed.resolvedAt).not.toBeNull();
      expect(closed.closedAt).not.toBeNull();
    });

    it('keeps the note against the entry that carried it', async () => {
      const id = await requestIn(RequestStatus.IN_PROGRESS);

      const updated = await service.updateStatus(
        id,
        { status: RequestStatus.WAITING, note: 'Waiting on the part number' },
        agent,
      );
      const last = updated.history[updated.history.length - 1];

      expect(last?.note).toBe('Waiting on the part number');
    });

    it('records every hop of a full lifecycle in order', async () => {
      const created = await service.createRequest(submission, employee);
      await service.claimRequest(created.id, agent);
      await service.updateStatus(created.id, { status: RequestStatus.WAITING }, agent);
      await service.updateStatus(created.id, { status: RequestStatus.IN_PROGRESS }, employee);
      await service.updateStatus(created.id, { status: RequestStatus.RESOLVED }, agent);
      await service.updateStatus(created.id, { status: RequestStatus.IN_PROGRESS }, employee);
      await service.updateStatus(created.id, { status: RequestStatus.RESOLVED }, agent);
      await service.updateStatus(created.id, { status: RequestStatus.CLOSED }, employee);

      const history = await service.getHistory(created.id, manager);

      expect(history.map((h) => h.type)).toEqual([
        'CREATED',
        'ASSIGNED',
        'STATUS_CHANGED',
        'STATUS_CHANGED',
        'STATUS_CHANGED',
        'REOPENED',
        'STATUS_CHANGED',
        'STATUS_CHANGED',
      ]);
    });

    it('returns history oldest first', async () => {
      const id = await requestIn(RequestStatus.RESOLVED);

      const history = await service.getHistory(id, manager);
      const times = history.map((h) => h.at.getTime());

      expect([...times].sort((a, b) => a - b)).toEqual(times);
    });

    it('will not show history to an unrelated employee', async () => {
      const id = await requestIn(RequestStatus.IN_PROGRESS);

      await expect(service.getHistory(id, bystander)).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});

async function seedActor(users: FakeUserRepository, role: UserRole, email: string): Promise<Actor> {
  const user = await users.create({ email, name: `Test ${role}`, role, passwordHash: 'x' });
  return { id: user.id, role };
}
