import { Router } from 'express';
import { AssignRequestSchema, ListMyRequestsSchema } from '../../application/dtos/AssignRequestSchema';
import { CreateRequestSchema, RequestIdSchema } from '../../application/dtos/CreateRequestSchema';
import { UpdateStatusSchema } from '../../application/dtos/UpdateStatusSchema';
import { UserRole } from '../../domain/enums/UserRole';
import { authenticate } from '../../infrastructure/middlewares/authMiddleware';
import { requireRole } from '../../infrastructure/middlewares/roleMiddleware';
import { validate } from '../../infrastructure/middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import type { RequestController } from '../controllers/RequestController';

export function buildRequestRoutes(controller: RequestController): Router {
  const router = Router();

  router.use(authenticate);

  // Anyone signed in can submit — that is the whole point of replacing email intake.
  router.post('/', validate(CreateRequestSchema), asyncHandler(controller.create));

  // Declared before '/:id' so "mine" is not swallowed as a request id.
  router.get(
    '/mine',
    requireRole(UserRole.AGENT, UserRole.MANAGER),
    validate(ListMyRequestsSchema),
    asyncHandler(controller.listMine),
  );

  router.get('/:id', validate(RequestIdSchema), asyncHandler(controller.getById));

  router.post(
    '/:id/claim',
    requireRole(UserRole.AGENT, UserRole.MANAGER),
    validate(RequestIdSchema),
    asyncHandler(controller.claim),
  );

  // No role gate here: who may move a request depends on their relationship to
  // it (requester, assignee, manager), which only the service can see.
  router.patch('/:id/status', validate(UpdateStatusSchema), asyncHandler(controller.updateStatus));

  router.get('/:id/history', validate(RequestIdSchema), asyncHandler(controller.getHistory));

  router.patch(
    '/:id/assign',
    requireRole(UserRole.MANAGER),
    validate(AssignRequestSchema),
    asyncHandler(controller.assign),
  );

  return router;
}
