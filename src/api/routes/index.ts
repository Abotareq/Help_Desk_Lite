import { Router } from 'express';
import { UserService } from '../../application/services/UserService';
import { MongoUserRepository } from '../../infrastructure/repositories/MongoUserRepository';
import { UserController } from '../controllers/UserController';
import { buildAuthRoutes, buildUserRoutes } from './userRoutes';

/**
 * Composition root — the single place concrete Mongo repositories are wired
 * into the services. Everything downstream of here sees interfaces only.
 */
export function buildApiRouter(): Router {
  const userRepository = new MongoUserRepository();

  const userService = new UserService(userRepository);

  const userController = new UserController(userService);

  const router = Router();
  router.use('/auth', buildAuthRoutes(userController));
  router.use('/users', buildUserRoutes(userController));

  return router;
}
