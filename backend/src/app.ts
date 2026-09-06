import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { buildApiRouter } from './api/routes';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './infrastructure/middlewares/errorHandler';
import type { RateLimitOptions } from './infrastructure/middlewares/rateLimiter';

export interface AppOptions {
  /**
   * Sign-in throttling. `false` disables it.
   *
   * Defaults to off under NODE_ENV=test: the limiter's store is in-memory and
   * keyed by IP, so every suite would share one counter for loopback and a
   * failed-login test in one file would start rejecting requests in another.
   * The dedicated suite passes explicit limits instead, which exercises the
   * real wiring without leaking state across unrelated tests.
   */
  rateLimit?: RateLimitOptions | false;
}

/**
 * Builds the Express app without binding a port, so integration tests can hand
 * it straight to supertest. `server.ts` owns the listening.
 */
export function createApp(options: AppOptions = {}): Express {
  const app = express();

  const rateLimitOptions =
    options.rateLimit !== undefined
      ? options.rateLimit
      : env.NODE_ENV === 'test'
        ? false
        : { windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS, max: env.LOGIN_RATE_LIMIT_MAX };

  // Rate limiting keys on req.ip, which is the proxy's address unless Express
  // is told how many hops to look back through X-Forwarded-For.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api', buildApiRouter(rateLimitOptions));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
