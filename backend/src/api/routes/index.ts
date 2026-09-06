import { Router } from 'express';
import type { RateLimitOptions } from '../../infrastructure/middlewares/rateLimiter';
import { RequestService } from '../../application/services/RequestService';
import { UserService } from '../../application/services/UserService';
import { MongoRequestRepository } from '../../infrastructure/repositories/MongoRequestRepository';
import { MongoUserRepository } from '../../infrastructure/repositories/MongoUserRepository';
import { RequestController } from '../controllers/RequestController';
import { UserController } from '../controllers/UserController';
import { buildRequestRoutes } from './requestRoutes';
import { buildAuthRoutes, buildUserRoutes } from './userRoutes';

/**
 * Composition root — the single place concrete Mongo repositories are wired
 * into the services. Everything downstream of here sees interfaces only.
 */
export function buildApiRouter(rateLimit: RateLimitOptions | false): Router {
  const userRepository = new MongoUserRepository();
  const requestRepository = new MongoRequestRepository();

  const userService = new UserService(userRepository, requestRepository);
  const requestService = new RequestService(requestRepository, userRepository);

  const userController = new UserController(userService);
  const requestController = new RequestController(requestService);

  const router = Router();
  router.use('/auth', buildAuthRoutes(userController, rateLimit));
  router.use('/users', buildUserRoutes(userController));
  router.use('/requests', buildRequestRoutes(requestController));

  return router;
}
