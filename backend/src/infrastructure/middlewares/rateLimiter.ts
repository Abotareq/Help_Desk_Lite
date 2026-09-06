import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../shared/AppError';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/**
 * Throttles sign-in attempts.
 *
 * Two decisions worth stating, because the obvious implementations of each are
 * wrong in a way that only shows up later:
 *
 * 1. Keyed by IP, not by email. Keying on the email address would let anyone
 *    lock a colleague out of their own account by failing their login enough
 *    times — turning a defence into a denial of service.
 *
 * 2. Only failures count (`skipSuccessfulRequests`). Someone signing in
 *    correctly from a shared office address is not attacking anything, and
 *    counting their successes would eventually lock out the whole floor.
 *
 * The store is in-memory, so the limit is per process. That is the right shape
 * for the single instance this is deployed as today; running more than one
 * would need a shared store, and the count would otherwise be per-instance.
 */
export function createLoginRateLimiter(options: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Rendered through the app's own error envelope rather than the library's
    // default body, so a client parses it exactly like every other failure.
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          'TOO_MANY_REQUESTS',
          'Too many sign-in attempts. Wait a few minutes and try again.',
        ),
      );
    },
  });
}
