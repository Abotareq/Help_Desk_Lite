import bcrypt from 'bcryptjs';
import { RequestService } from '../../../src/application/services/RequestService';
import { UserService } from '../../../src/application/services/UserService';
import { RequestCategory } from '../../../src/domain/enums/RequestCategory';
import { RequestPriority } from '../../../src/domain/enums/RequestPriority';
import { RequestStatus } from '../../../src/domain/enums/RequestStatus';
import { UserRole } from '../../../src/domain/enums/UserRole';
import { FakeRequestRepository } from '../../fakes/FakeRequestRepository';
import { FakeUserRepository } from '../../fakes/FakeUserRepository';

const submission = {
  title: 'Screen flickers intermittently',
  description: 'The external monitor flickers every few minutes and then recovers.',
  category: RequestCategory.IT,
  priority: RequestPriority.MEDIUM,
};

describe('UserService account administration', () => {
  let users: FakeUserRepository;
  let requests: FakeRequestRepository;
  let service: UserService;
  let requestService: RequestService;

  let manager: { id: string; role: UserRole };
  let otherManager: { id: string; role: UserRole };
  let agent: { id: string; role: UserRole };
  let employee: { id: string; role: UserRole };

  async function makeUser(role: UserRole, email: string) {
    const u = await service.createUser({ email, name: `Test ${role}`, role, password: 'password123' });
    return { id: u.id, role };
  }

  beforeEach(async () => {
    users = new FakeUserRepository();
    requests = new FakeRequestRepository();
    service = new UserService(users, requests);
    requestService = new RequestService(requests, users);

    manager = await makeUser(UserRole.MANAGER, 'manager@example.com');
    otherManager = await makeUser(UserRole.MANAGER, 'manager2@example.com');
    agent = await makeUser(UserRole.AGENT, 'agent@example.com');
    employee = await makeUser(UserRole.EMPLOYEE, 'employee@example.com');
  });

  describe('editing an account', () => {
    it('changes a name', async () => {
      const { user } = await service.updateUser(agent.id, { name: 'Renamed Agent' }, manager);

      expect(user.name).toBe('Renamed Agent');
    });

    it('changes a role', async () => {
      const { user } = await service.updateUser(employee.id, { role: UserRole.AGENT }, manager);

      expect(user.role).toBe(UserRole.AGENT);
    });

    it('never returns the password hash', async () => {
      const { user } = await service.updateUser(agent.id, { name: 'Nope' }, manager);

      expect(user).not.toHaveProperty('passwordHash');
    });

    it('leaves untouched fields alone', async () => {
      const { user } = await service.updateUser(agent.id, { name: 'Just The Name' }, manager);

      expect(user.role).toBe(UserRole.AGENT);
      expect(user.isActive).toBe(true);
      expect(user.email).toBe('agent@example.com');
    });

    it('404s an unknown user', async () => {
      await expect(
        service.updateUser('000000000000000000000099', { name: 'Ghost' }, manager),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('deactivating', () => {
    it('closes the account, which login already refuses', async () => {
      const { user } = await service.updateUser(agent.id, { isActive: false }, manager);

      expect(user.isActive).toBe(false);
      await expect(
        service.login({ email: 'agent@example.com', password: 'password123' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('can be reversed', async () => {
      await service.updateUser(agent.id, { isActive: false }, manager);
      const { user } = await service.updateUser(agent.id, { isActive: true }, manager);

      expect(user.isActive).toBe(true);
      await expect(
        service.login({ email: 'agent@example.com', password: 'password123' }),
      ).resolves.toMatchObject({ user: { id: agent.id } });
    });

    it('stops the account being given new work', async () => {
      const created = await requestService.createRequest(submission, employee);
      await service.updateUser(agent.id, { isActive: false }, manager);

      await expect(
        requestService.assignRequest(created.id, agent.id, manager),
      ).rejects.toMatchObject({ statusCode: 422 });
    });
  });

  describe('locking yourself out', () => {
    it('refuses to let a manager deactivate their own account', async () => {
      await expect(
        service.updateUser(manager.id, { isActive: false }, manager),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('refuses to let a manager drop their own manager role', async () => {
      await expect(
        service.updateUser(manager.id, { role: UserRole.AGENT }, manager),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('lets one manager deactivate another', async () => {
      const { user } = await service.updateUser(otherManager.id, { isActive: false }, manager);

      expect(user.isActive).toBe(false);
    });
  });

  describe('the last active manager', () => {
    beforeEach(async () => {
      // Leave exactly one active manager standing.
      await service.updateUser(otherManager.id, { isActive: false }, manager);
    });

    it('cannot be deactivated, even by another manager', async () => {
      const rescuer = await makeUser(UserRole.MANAGER, 'temp@example.com');
      await service.updateUser(rescuer.id, { isActive: false }, manager);

      await expect(
        service.updateUser(manager.id, { isActive: false }, otherManager),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('explains why rather than just refusing', async () => {
      await expect(
        service.updateUser(manager.id, { isActive: false }, otherManager),
      ).rejects.toMatchObject({ message: expect.stringContaining('last active manager') });
    });

    it('cannot be demoted out of the manager role', async () => {
      await expect(
        service.updateUser(manager.id, { role: UserRole.AGENT }, otherManager),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('can be deactivated once another manager is promoted', async () => {
      await service.updateUser(agent.id, { role: UserRole.MANAGER }, manager);

      const { user } = await service.updateUser(manager.id, { isActive: false }, otherManager);

      expect(user.isActive).toBe(false);
    });

    it('does not count deactivated managers as cover', async () => {
      // otherManager is a MANAGER but inactive, so it must not satisfy the check.
      await expect(
        service.updateUser(manager.id, { isActive: false }, otherManager),
      ).rejects.toMatchObject({ statusCode: 422 });
    });
  });

  describe('work left behind', () => {
    let openId: string;
    let openRef: string;

    beforeEach(async () => {
      const open = await requestService.createRequest(submission, employee);
      await requestService.claimRequest(open.id, agent);
      openId = open.id;
      openRef = open.reference;
    });

    it('reports the open requests a deactivation strands', async () => {
      const { orphanedRequests } = await service.updateUser(agent.id, { isActive: false }, manager);

      expect(orphanedRequests).toEqual([
        { id: openId, reference: openRef, status: RequestStatus.IN_PROGRESS },
      ]);
    });

    it('reports them when a handler is demoted to employee, which strands work too', async () => {
      const { orphanedRequests } = await service.updateUser(
        agent.id,
        { role: UserRole.EMPLOYEE },
        manager,
      );

      expect(orphanedRequests.map((r) => r.id)).toEqual([openId]);
    });

    it('does not count closed work as stranded', async () => {
      await requestService.updateStatus(openId, { status: RequestStatus.RESOLVED }, agent);
      await requestService.updateStatus(openId, { status: RequestStatus.CLOSED }, manager);

      const { orphanedRequests } = await service.updateUser(agent.id, { isActive: false }, manager);

      expect(orphanedRequests).toEqual([]);
    });

    it('warns rather than blocking — the deactivation still happens', async () => {
      const { user, orphanedRequests } = await service.updateUser(
        agent.id,
        { isActive: false },
        manager,
      );

      expect(user.isActive).toBe(false);
      expect(orphanedRequests).toHaveLength(1);
    });

    it('leaves the requests and their history intact', async () => {
      await service.updateUser(agent.id, { isActive: false }, manager);

      const still = await requestService.getRequestById(openId, manager);
      expect(still.assigneeId).toBe(agent.id);
      expect(still.history.length).toBeGreaterThan(1);
    });

    it('reports nothing for a plain rename', async () => {
      const { orphanedRequests } = await service.updateUser(agent.id, { name: 'Renamed' }, manager);

      expect(orphanedRequests).toEqual([]);
    });

    it('reports nothing when promoting an agent to manager, who can still hold work', async () => {
      const { orphanedRequests } = await service.updateUser(
        agent.id,
        { role: UserRole.MANAGER },
        manager,
      );

      expect(orphanedRequests).toEqual([]);
    });
  });

  describe('password reset', () => {
    it('lets the user log in with the new password', async () => {
      await service.resetPassword(agent.id, { password: 'BrandNewPass1' });

      await expect(
        service.login({ email: 'agent@example.com', password: 'BrandNewPass1' }),
      ).resolves.toMatchObject({ user: { id: agent.id } });
    });

    it('invalidates the old password', async () => {
      await service.resetPassword(agent.id, { password: 'BrandNewPass1' });

      await expect(
        service.login({ email: 'agent@example.com', password: 'password123' }),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('stores a hash, not the password', async () => {
      await service.resetPassword(agent.id, { password: 'BrandNewPass1' });

      const stored = await users.findByEmail('agent@example.com');
      expect(stored?.passwordHash).not.toBe('BrandNewPass1');
      await expect(bcrypt.compare('BrandNewPass1', stored!.passwordHash)).resolves.toBe(true);
    });

    it('never returns the hash', async () => {
      const user = await service.resetPassword(agent.id, { password: 'BrandNewPass1' });

      expect(user).not.toHaveProperty('passwordHash');
    });

    it('404s an unknown user', async () => {
      await expect(
        service.resetPassword('000000000000000000000099', { password: 'BrandNewPass1' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
