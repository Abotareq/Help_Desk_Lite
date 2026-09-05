import { loadEnv } from '../../../src/config/env';

/** A production-shaped environment: nothing is defaulted for us. */
const production = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://db:27017/helpdesk',
  JWT_SECRET: 'a-sufficiently-long-secret-value',
} as NodeJS.ProcessEnv;

describe('loadEnv', () => {
  describe('valid configuration', () => {
    it('reads a complete production environment', () => {
      const env = loadEnv(production);

      expect(env.NODE_ENV).toBe('production');
      expect(env.MONGODB_URI).toBe('mongodb://db:27017/helpdesk');
    });

    it('defaults PORT to 3000 and coerces it from a string', () => {
      expect(loadEnv(production).PORT).toBe(3000);
      expect(loadEnv({ ...production, PORT: '8080' }).PORT).toBe(8080);
    });

    it('defaults NODE_ENV to development', () => {
      const { NODE_ENV: _omitted, ...withoutNodeEnv } = production;

      expect(loadEnv(withoutNodeEnv as NodeJS.ProcessEnv).NODE_ENV).toBe('development');
    });

    it('defaults JWT_EXPIRES_IN', () => {
      expect(loadEnv(production).JWT_EXPIRES_IN).toBe('12h');
    });
  });

  describe('test placeholders', () => {
    // Tests never touch a real deployment, so a test run does not need real
    // secrets — but nothing else may fall back to a placeholder.
    it('fills in a URI and secret under NODE_ENV=test', () => {
      const env = loadEnv({ NODE_ENV: 'test' } as NodeJS.ProcessEnv);

      expect(env.MONGODB_URI).toContain('mongodb://');
      expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(16);
    });

    it('still prefers a real value when one is supplied', () => {
      const env = loadEnv({
        NODE_ENV: 'test',
        MONGODB_URI: 'mongodb://explicit:27017/x',
      } as NodeJS.ProcessEnv);

      expect(env.MONGODB_URI).toBe('mongodb://explicit:27017/x');
    });
  });

  describe('failing fast on a bad configuration', () => {
    it('refuses a missing MONGODB_URI outside tests', () => {
      const { MONGODB_URI: _omitted, ...withoutUri } = production;

      expect(() => loadEnv(withoutUri as NodeJS.ProcessEnv)).toThrow(/MONGODB_URI/);
    });

    it('refuses a missing JWT_SECRET outside tests', () => {
      const { JWT_SECRET: _omitted, ...withoutSecret } = production;

      expect(() => loadEnv(withoutSecret as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/);
    });

    it('refuses a JWT_SECRET that is too short to be worth signing with', () => {
      expect(() => loadEnv({ ...production, JWT_SECRET: 'short' })).toThrow(/at least 16/);
    });

    it('refuses an unrecognised NODE_ENV', () => {
      expect(() => loadEnv({ ...production, NODE_ENV: 'staging' })).toThrow(
        /Invalid environment configuration/,
      );
    });

    it('refuses a non-numeric PORT', () => {
      expect(() => loadEnv({ ...production, PORT: 'eighty' })).toThrow(/PORT/);
    });

    it('refuses a negative PORT', () => {
      expect(() => loadEnv({ ...production, PORT: '-1' })).toThrow(/PORT/);
    });

    it('names every problem at once, not just the first', () => {
      const message = (() => {
        try {
          loadEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
          return '';
        } catch (err) {
          return (err as Error).message;
        }
      })();

      expect(message).toContain('MONGODB_URI');
      expect(message).toContain('JWT_SECRET');
    });
  });
});
