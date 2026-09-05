import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserRole } from '../../domain/enums/UserRole';
import { AppError } from '../../shared/AppError';

/**
 * Route-level role gate. Anything finer than "which roles may call this at all"
 * belongs in the service, where it can see the record being acted on.
 */
export function requireRole(...allowed: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!allowed.includes(req.user.role)) {
      next(AppError.forbidden(`This action requires one of: ${allowed.join(', ')}`));
      return;
    }
    next();
  };
}
