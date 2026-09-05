import { Router } from 'express';
import { CreateRequestSchema, RequestIdSchema } from '../../application/dtos/CreateRequestSchema';
import { authenticate } from '../../infrastructure/middlewares/authMiddleware';
import { validate } from '../../infrastructure/middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import type { RequestController } from '../controllers/RequestController';

export function buildRequestRoutes(controller: RequestController): Router {
  const router = Router();

  router.use(authenticate);

  // Anyone signed in can submit — that is the whole point of replacing email intake.
  router.post('/', validate(CreateRequestSchema), asyncHandler(controller.create));

  router.get('/:id', validate(RequestIdSchema), asyncHandler(controller.getById));

  return router;
}
