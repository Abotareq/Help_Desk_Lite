import { Router } from 'express';
import { CreateUserSchema, ListUsersSchema } from '../../application/dtos/CreateUserSchema';
import { LoginSchema } from '../../application/dtos/LoginSchema';
import { ResetPasswordSchema, UpdateUserSchema, UserIdSchema } from '../../application/dtos/UpdateUserSchema';
import { UserRole } from '../../domain/enums/UserRole';
import { authenticate } from '../../infrastructure/middlewares/authMiddleware';
import { requireRole } from '../../infrastructure/middlewares/roleMiddleware';
import {
  createLoginRateLimiter,
  type RateLimitOptions,
} from '../../infrastructure/middlewares/rateLimiter';
import { validate } from '../../infrastructure/middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import type { UserController } from '../controllers/UserController';

export function buildAuthRoutes(
  controller: UserController,
  rateLimit: RateLimitOptions | false,
): Router {
  const router = Router();

  // Throttling runs before validation: a flood of malformed bodies should cost
  // no more to reject than a flood of well-formed guesses.
  const throttle = rateLimit === false ? [] : [createLoginRateLimiter(rateLimit)];

  router.post('/login', ...throttle, validate(LoginSchema), asyncHandler(controller.login));

  return router;
}

export function buildUserRoutes(controller: UserController): Router {
  const router = Router();

  router.use(authenticate);

  router.get('/me', asyncHandler(controller.me));

  // Any signed-in user may look up one colleague by id. The PRD's requester
  // "wants to know who's handling it", and without this they cannot: listing
  // users is staff-only, so a name would never resolve. Declared after '/me' so
  // the literal path is not read as an id.
  router.get('/:id', validate(UserIdSchema), asyncHandler(controller.getUser))

  router.post(
    '/',
    requireRole(UserRole.MANAGER),
    validate(CreateUserSchema),
    asyncHandler(controller.createUser),
  );

  router.get(
    '/',
    requireRole(UserRole.MANAGER, UserRole.AGENT),
    validate(ListUsersSchema),
    asyncHandler(controller.listUsers),
  );

  router.patch(
    '/:id',
    requireRole(UserRole.MANAGER),
    validate(UpdateUserSchema),
    asyncHandler(controller.updateUser),
  );

  router.post(
    '/:id/password',
    requireRole(UserRole.MANAGER),
    validate(ResetPasswordSchema),
    asyncHandler(controller.resetPassword),
  );

  return router;
}
