import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parsed once at import time so the process fails fast on a bad config
 * rather than at the first request that happens to need a variable.
 *
 * Tests never touch a real deployment, so they get safe placeholders —
 * the in-memory Mongo server hands the real URI to connectDatabase directly.
 */
function loadEnv(): Env {
  const isTest = process.env.NODE_ENV === 'test';
  const raw = {
    ...process.env,
    MONGODB_URI: process.env.MONGODB_URI ?? (isTest ? 'mongodb://127.0.0.1:27017/helpdesk_test' : undefined),
    JWT_SECRET: process.env.JWT_SECRET ?? (isTest ? 'test-secret-value-not-for-production' : undefined),
  };

  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export const env = loadEnv();
