import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),

  /** Sign-in throttling. Defaults to 10 failed attempts per 15 minutes, per IP. */
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  /**
   * How many reverse proxies sit in front of this. Rate limiting keys on the
   * client IP, and behind a proxy every request appears to come from the proxy
   * unless Express is told how far to look back through X-Forwarded-For.
   * Left at 0 because trusting a header nobody sets is worse than not trusting
   * one at all — it would let a caller spoof their way past the limit.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parsed once at import time so the process fails fast on a bad config
 * rather than at the first request that happens to need a variable.
 *
 * Tests never touch a real deployment, so they get safe placeholders —
 * the in-memory Mongo server hands the real URI to connectDatabase directly.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const isTest = source.NODE_ENV === 'test';
  const raw = {
    ...source,
    MONGODB_URI: source.MONGODB_URI ?? (isTest ? 'mongodb://127.0.0.1:27017/helpdesk_test' : undefined),
    JWT_SECRET: source.JWT_SECRET ?? (isTest ? 'test-secret-value-not-for-production' : undefined),
  };

  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export const env = loadEnv();
