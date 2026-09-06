import request from 'supertest';
import { createApp } from '../../src/app';
import { UserRole } from '../../src/domain/enums/UserRole';
import { createActor, type TestActor } from '../helpers/api';
import { clearTestDb, startTestDb, stopTestDb } from '../setup/testDb';

/**
 * Each test builds its own app so it gets a fresh limiter store. The store is
 * in-memory and keyed by IP, and every supertest request comes from loopback —
 * so a shared app would carry one test's failures into the next.
 */
function appWithLimit(max: number, windowMs = 60_000) {
  return createApp({ rateLimit: { windowMs, max } });
}

function attemptLogin(app: ReturnType<typeof createApp>, email: string, password: string) {
  return request(app).post('/api/auth/login').send({ email, password });
}

let user: TestActor;

beforeAll(async () => {
  await startTestDb();
});
beforeEach(async () => {
  user = await createActor(UserRole.EMPLOYEE, { password: 'correct-password-1' });
});
afterEach(async () => {
  await clearTestDb();
});
afterAll(async () => {
  await stopTestDb();
});

describe('sign-in throttling', () => {
  it('lets attempts through up to the limit', async () => {
    const app = appWithLimit(3);

    for (let i = 0; i < 3; i += 1) {
      const res = await attemptLogin(app, user.email, 'wrong');
      expect(res.status).toBe(401);
    }
  });

  it('refuses the attempt after the limit with 429', async () => {
    const app = appWithLimit(3);

    for (let i = 0; i < 3; i += 1) await attemptLogin(app, user.email, 'wrong');

    const blocked = await attemptLogin(app, user.email, 'wrong');
    expect(blocked.status).toBe(429);
  });

  it('reports it through the app error envelope, like every other failure', async () => {
    const app = appWithLimit(1);

    await attemptLogin(app, user.email, 'wrong');
    const blocked = await attemptLogin(app, user.email, 'wrong');

    expect(blocked.body.error).toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    expect(blocked.body.error.message).toMatch(/too many sign-in attempts/i);
  });

  it('advertises the limit in standard headers', async () => {
    const app = appWithLimit(5);

    const res = await attemptLogin(app, user.email, 'wrong');

    expect(res.headers['ratelimit-policy']).toBeDefined();
    // The legacy X-RateLimit-* headers are deliberately off.
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  describe('what counts towards the limit', () => {
    // Someone signing in correctly from a shared office address is not
    // attacking anything; counting successes would lock out the whole floor.
    it('does not count successful sign-ins', async () => {
      const app = appWithLimit(2);

      for (let i = 0; i < 5; i += 1) {
        const res = await attemptLogin(app, user.email, 'correct-password-1');
        expect(res.status).toBe(200);
      }
    });

    it('still blocks failures once successes have gone through', async () => {
      const app = appWithLimit(2);

      await attemptLogin(app, user.email, 'correct-password-1');
      await attemptLogin(app, user.email, 'wrong');
      await attemptLogin(app, user.email, 'wrong');

      const blocked = await attemptLogin(app, user.email, 'wrong');
      expect(blocked.status).toBe(429);
    });

    it('counts a malformed body too, so a flood of junk is no cheaper', async () => {
      const app = appWithLimit(2);

      // These fail validation rather than authentication, but they still cost
      // the server a request.
      await request(app).post('/api/auth/login').send({});
      await request(app).post('/api/auth/login').send({});

      const blocked = await request(app).post('/api/auth/login').send({});
      expect(blocked.status).toBe(429);
    });
  });

  describe('who gets locked out', () => {
    // Keying on the email address would let anyone lock a colleague out of
    // their own account by failing their login enough times — a defence that
    // becomes a denial of service.
    it('does not let attempts against one account block another', async () => {
      const app = appWithLimit(2);
      const victim = await createActor(UserRole.EMPLOYEE, { password: 'correct-password-1' });

      for (let i = 0; i < 2; i += 1) await attemptLogin(app, victim.email, 'wrong');

      // Same IP, so this is expected to be throttled — the point is that the
      // limit belongs to the caller, not to the victim's account.
      const blocked = await attemptLogin(app, user.email, 'correct-password-1');
      expect(blocked.status).toBe(429);

      // From a different caller, the victim's own account still signs in.
      const elsewhere = appWithLimit(2);
      const ok = await attemptLogin(elsewhere, victim.email, 'correct-password-1');
      expect(ok.status).toBe(200);
    });

    it('leaves a throttled account able to sign in once the caller resets', async () => {
      const app = appWithLimit(1);
      await attemptLogin(app, user.email, 'wrong');
      expect((await attemptLogin(app, user.email, 'correct-password-1')).status).toBe(429);

      const fresh = appWithLimit(1);
      expect((await attemptLogin(fresh, user.email, 'correct-password-1')).status).toBe(200);
    });
  });

  describe('scope', () => {
    it('does not throttle anything but sign-in', async () => {
      const app = appWithLimit(1);
      await attemptLogin(app, user.email, 'wrong');
      await attemptLogin(app, user.email, 'wrong');

      // The limiter is mounted on the login route alone, so unrelated traffic
      // is unaffected by someone guessing passwords.
      for (let i = 0; i < 5; i += 1) {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
      }
    });

    it('is off by default under NODE_ENV=test', async () => {
      const app = createApp();

      for (let i = 0; i < 12; i += 1) {
        const res = await attemptLogin(app, user.email, 'wrong');
        expect(res.status).toBe(401);
      }
    });
  });
});
