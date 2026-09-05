import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../../shared/AppError';

/**
 * One generic validator reused on every route: validate(CreateRequestSchema).
 *
 * Schemas describe the parts of the request they care about (`body`, `query`,
 * `params`); whatever a schema parses is written back so downstream handlers
 * see coerced, defaulted values rather than raw strings.
 */
export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as Partial<Pick<Request, 'body' | 'query' | 'params'>>;

      if (parsed.body !== undefined) req.body = parsed.body;
      // req.query and req.params are getter-only in some Express versions, so
      // assign onto the existing object instead of replacing the reference.
      if (parsed.query !== undefined) Object.assign(req.query, parsed.query);
      if (parsed.params !== undefined) Object.assign(req.params, parsed.params);

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          AppError.badRequest(
            'Validation failed',
            err.issues.map((issue) => ({
              // Drop the leading body/query/params segment — callers care about
              // the field name, not where we happened to read it from.
              field: issue.path.slice(1).join('.') || issue.path.join('.'),
              message: issue.message,
            })),
          ),
        );
        return;
      }
      next(err);
    }
  };
}
