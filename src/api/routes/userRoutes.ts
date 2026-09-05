import { Router } from 'express';
import { CreateUserSchema, ListUsersSchema } from '../../application/dtos/CreateUserSchema';
import { LoginSchema } from '../../application/dtos/LoginSchema';
import { ResetPasswordSchema, UpdateUserSchema } from '../../application/dtos/UpdateUserSchema';
import { UserRole } from '../../domain/enums/UserRole';
import { authenticate } from '../../infrastructure/middlewares/authMiddleware';
import { requireRole } from '../../infrastructure/middlewares/roleMiddleware';
import { validate } from '../../infrastructure/middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import type { UserController } from '../controllers/UserController';

export function buildAuthRoutes(controller: UserController): Router {
  const router = Router();

  router.post('/login', validate(LoginSchema), asyncHandler(controller.login));

  return router;
}

export function buildUserRoutes(controller: UserController): Router {
  const router = Router();

  router.use(authenticate);

  router.get('/me', asyncHandler(controller.me));

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
