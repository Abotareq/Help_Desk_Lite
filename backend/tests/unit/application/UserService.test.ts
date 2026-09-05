import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserService } from '../../../src/application/services/UserService';
import { UserRole } from '../../../src/domain/enums/UserRole';
import { AppError } from '../../../src/shared/AppError';
import { FakeRequestRepository } from '../../fakes/FakeRequestRepository';
import { FakeUserRepository } from '../../fakes/FakeUserRepository';

describe('UserService', () => {
  let repo: FakeUserRepository;
  let service: UserService;

  beforeEach(() => {
    repo = new FakeUserRepository();
    service = new UserService(repo, new FakeRequestRepository());
  });

  describe('createUser', () => {
    it('stores a bcrypt hash and never returns the password', async () => {
      const user = await service.createUser({
        email: 'Ada@Example.com',
        name: 'Ada Lovelace',
        role: UserRole.AGENT,
        password: 'supersecret',
      });

      expect(user).not.toHaveProperty('passwordHash');
      expect(user.email).toBe('ada@example.com');

      const stored = await repo.findByEmail('ada@example.com');
      expect(stored?.passwordHash).not.toBe('supersecret');
      await expect(bcrypt.compare('supersecret', stored!.passwordHash)).resolves.toBe(true);
    });

    it('rejects a duplicate email', async () => {
      await service.createUser({
        email: 'dup@example.com',
        name: 'First',
        role: UserRole.EMPLOYEE,
        password: 'password1',
      });

      await expect(
        service.createUser({
          email: 'dup@example.com',
          name: 'Second',
          role: UserRole.EMPLOYEE,
          password: 'password2',
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.createUser({
        email: 'agent@example.com',
        name: 'Sam Agent',
        role: UserRole.AGENT,
        password: 'correct-horse',
      });
    });

    it('returns a token carrying the id, email and role', async () => {
      const result = await service.login({ email: 'agent@example.com', password: 'correct-horse' });

      const payload = jwt.decode(result.token) as { sub: string; email: string; role: string };
      expect(payload.email).toBe('agent@example.com');
      expect(payload.role).toBe(UserRole.AGENT);
      expect(payload.sub).toBe(result.user.id);
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const wrongPassword = await service
        .login({ email: 'agent@example.com', password: 'nope' })
        .catch((e: AppError) => e);
      const unknownEmail = await service
        .login({ email: 'ghost@example.com', password: 'correct-horse' })
        .catch((e: AppError) => e);

      expect(wrongPassword).toBeInstanceOf(AppError);
      expect((wrongPassword as AppError).statusCode).toBe(401);
      expect((unknownEmail as AppError).message).toBe((wrongPassword as AppError).message);
    });

    it('refuses a deactivated account', async () => {
      repo.deactivate('agent@example.com');

      await expect(
        service.login({ email: 'agent@example.com', password: 'correct-horse' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getActiveHandler', () => {
    it('rejects an employee as a request owner', async () => {
      const employee = await service.createUser({
        email: 'emp@example.com',
        name: 'Eve Employee',
        role: UserRole.EMPLOYEE,
        password: 'password1',
      });

      await expect(service.getActiveHandler(employee.id)).rejects.toMatchObject({ statusCode: 422 });
    });

    it('accepts an agent', async () => {
      const agent = await service.createUser({
        email: 'a2@example.com',
        name: 'Alex Agent',
        role: UserRole.AGENT,
        password: 'password1',
      });

      await expect(service.getActiveHandler(agent.id)).resolves.toMatchObject({ id: agent.id });
    });
  });
});
