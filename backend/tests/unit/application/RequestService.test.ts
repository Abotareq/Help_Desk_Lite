import { RequestService, type Actor } from '../../../src/application/services/RequestService';
import { RequestCategory } from '../../../src/domain/enums/RequestCategory';
import { RequestPriority } from '../../../src/domain/enums/RequestPriority';
import { RequestStatus } from '../../../src/domain/enums/RequestStatus';
import { UserRole } from '../../../src/domain/enums/UserRole';
import { FakeRequestRepository } from '../../fakes/FakeRequestRepository';
import { FakeUserRepository } from '../../fakes/FakeUserRepository';

const employee: Actor = { id: '000000000000000000000001', role: UserRole.EMPLOYEE };
const otherEmployee: Actor = { id: '000000000000000000000002', role: UserRole.EMPLOYEE };
const agent: Actor = { id: '000000000000000000000003', role: UserRole.AGENT };
const manager: Actor = { id: '000000000000000000000004', role: UserRole.MANAGER };

const validInput = {
  title: 'Laptop will not boot',
  description: 'It powers on, shows the logo, then restarts in a loop.',
  category: RequestCategory.IT,
  priority: RequestPriority.HIGH,
};

describe('RequestService.createRequest', () => {
  let repo: FakeRequestRepository;
  let service: RequestService;

  beforeEach(() => {
    repo = new FakeRequestRepository();
    service = new RequestService(repo, new FakeUserRepository());
  });

  it('opens the request as NEW, unassigned, owned by the submitter', async () => {
    const created = await service.createRequest(validInput, employee);

    expect(created.status).toBe(RequestStatus.NEW);
    expect(created.assigneeId).toBeNull();
    expect(created.requesterId).toBe(employee.id);
  });

  it('gives each request a unique, human-readable reference', async () => {
    const first = await service.createRequest(validInput, employee);
    const second = await service.createRequest(validInput, otherEmployee);

    expect(first.reference).toBe('HD-000001');
    expect(second.reference).toBe('HD-000002');
    expect(first.id).not.toBe(second.id);
  });

  it('seeds the history with a CREATED entry so it is never empty', async () => {
    const created = await service.createRequest(validInput, employee);

    expect(created.history).toHaveLength(1);
    expect(created.history[0]).toMatchObject({
      type: 'CREATED',
      fromStatus: null,
      toStatus: RequestStatus.NEW,
      actorId: employee.id,
    });
  });

  it('keeps the submitted category and priority', async () => {
    const created = await service.createRequest(validInput, employee);

    expect(created.category).toBe(RequestCategory.IT);
    expect(created.priority).toBe(RequestPriority.HIGH);
  });
});

describe('RequestService.getRequestById', () => {
  let repo: FakeRequestRepository;
  let service: RequestService;
  let requestId: string;

  beforeEach(async () => {
    repo = new FakeRequestRepository();
    service = new RequestService(repo, new FakeUserRepository());
    const created = await service.createRequest(validInput, employee);
    requestId = created.id;
  });

  it('lets the requester read their own request', async () => {
    await expect(service.getRequestById(requestId, employee)).resolves.toMatchObject({ id: requestId });
  });

  it('lets a manager read any request', async () => {
    await expect(service.getRequestById(requestId, manager)).resolves.toMatchObject({ id: requestId });
  });

  it('lets an agent read an unassigned request from the queue', async () => {
    await expect(service.getRequestById(requestId, agent)).resolves.toMatchObject({ id: requestId });
  });

  it('hides a request from an unrelated employee behind a 404 rather than a 403', async () => {
    await expect(service.getRequestById(requestId, otherEmployee)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('404s an unknown id', async () => {
    await expect(service.getRequestById('000000000000000000000099', manager)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
