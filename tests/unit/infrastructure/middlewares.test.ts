import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { z } from 'zod';
import { requireUser } from '../../../src/infrastructure/middlewares/authMiddleware';
import {
  errorHandler,
  notFoundHandler,
} from '../../../src/infrastructure/middlewares/errorHandler';
import { requireRole } from '../../../src/infrastructure/middlewares/roleMiddleware';
import { validate } from '../../../src/infrastructure/middlewares/validate';
import { UserRole } from '../../../src/domain/enums/UserRole';
import { AppError } from '../../../src/shared/AppError';

interface MockResponse extends Response {
  status: jest.Mock;
  json: jest.Mock;
}

function mockRes(): MockResponse {
  const res = {} as MockResponse;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return { body: {}, query: {}, params: {}, headers: {}, ...overrides } as Request;
}

/** The error the handler was actually given, whatever wrapped it. */
function payload(res: MockResponse) {
  return res.json.mock.calls[0]?.[0];
}

describe('errorHandler', () => {
  it('renders an AppError with its own status and code', () => {
    const res = mockRes();

    errorHandler(AppError.forbidden('Nope'), mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(payload(res).error).toMatchObject({ code: 'FORBIDDEN', message: 'Nope' });
  });

  it('includes details when the error carries them', () => {
    const res = mockRes();
    const details = [{ field: 'title', message: 'Required' }];

    errorHandler(AppError.badRequest('Validation failed', details), mockReq(), res, jest.fn());

    expect(payload(res).error.details).toEqual(details);
  });

  it('omits the details key entirely when there are none', () => {
    const res = mockRes();

    errorHandler(AppError.notFound(), mockReq(), res, jest.fn());

    expect(payload(res).error).not.toHaveProperty('details');
  });

  // A unique-index violation is a conflict the caller can act on, not a bug.
  it('translates a Mongo duplicate key (11000) into a 409', () => {
    const res = mockRes();

    errorHandler({ code: 11000, message: 'E11000 duplicate key' }, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(payload(res).error.code).toBe('CONFLICT');
  });

  it('does not mistake a non-11000 numeric code for a duplicate key', () => {
    const res = mockRes();

    errorHandler({ code: 11001 }, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('does not trip over a null error', () => {
    const res = mockRes();

    errorHandler(null, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
  });

  describe('unexpected errors', () => {
    it('returns an opaque 500 rather than leaking the cause', () => {
      const res = mockRes();

      errorHandler(new Error('connection string was mongodb://user:hunter2@host'), mockReq(), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(JSON.stringify(payload(res))).not.toContain('hunter2');
      expect(payload(res).error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      });
    });

    it('stays quiet under NODE_ENV=test so the suite output is readable', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      errorHandler(new Error('boom'), mockReq(), mockRes(), jest.fn());

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('logs the cause outside tests, where an operator needs it', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        errorHandler(new Error('boom'), mockReq(), mockRes(), jest.fn());
        expect(spy).toHaveBeenCalledWith('[unhandled]', expect.any(Error));
      } finally {
        process.env.NODE_ENV = original;
        spy.mockRestore();
      }
    });
  });
});

describe('notFoundHandler', () => {
  it('passes a 404 naming the method and path', () => {
    const next = jest.fn();

    notFoundHandler(mockReq({ method: 'GET', originalUrl: '/api/nope' }), mockRes(), next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('GET /api/nope');
  });
});

describe('requireRole', () => {
  it('lets an allowed role through', () => {
    const next = jest.fn();

    requireRole(UserRole.MANAGER)(
      mockReq({ user: { id: 'u1', email: 'm@x.com', role: UserRole.MANAGER } }),
      mockRes(),
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('refuses a role that is not on the list, saying which are', () => {
    const next = jest.fn();

    requireRole(UserRole.MANAGER, UserRole.AGENT)(
      mockReq({ user: { id: 'u1', email: 'e@x.com', role: UserRole.EMPLOYEE } }),
      mockRes(),
      next,
    );

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(403);
    expect(err.message).toContain(UserRole.MANAGER);
  });

  // Guards against a route being wired with requireRole but no authenticate:
  // the failure must be a 401, never an unguarded pass-through.
  it('returns 401 rather than allowing the request when no user is attached', () => {
    const next = jest.fn();

    requireRole(UserRole.MANAGER)(mockReq(), mockRes(), next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
  });
});

describe('requireUser', () => {
  it('returns the authenticated user', () => {
    const user = { id: 'u1', email: 'a@x.com', role: UserRole.AGENT };

    expect(requireUser(mockReq({ user }))).toEqual(user);
  });

  it('throws a 401 rather than returning undefined', () => {
    expect(() => requireUser(mockReq())).toThrow(AppError);
    expect(() => requireUser(mockReq())).toThrow(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('validate', () => {
  const schema = z.object({
    body: z.object({ name: z.string().min(2), count: z.coerce.number().default(1) }),
  });

  it('writes coerced and defaulted values back onto the request', () => {
    const req = mockReq({ body: { name: 'Ada' } });
    const next = jest.fn();

    validate(schema)(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Ada', count: 1 });
  });

  it('assigns onto req.query rather than replacing the object', () => {
    const querySchema = z.object({ query: z.object({ page: z.coerce.number().default(2) }) });
    const req = mockReq();
    const originalQuery = req.query;

    validate(querySchema)(req, mockRes(), jest.fn());

    expect(req.query).toBe(originalQuery);
    expect(req.query.page).toBe(2);
  });

  it('reports the field name without the body/query prefix', () => {
    const next = jest.fn();

    validate(schema)(mockReq({ body: { name: 'x' } }), mockRes(), next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual([expect.objectContaining({ field: 'name' })]);
  });

  // A schema that blows up for some other reason must not be reported to the
  // caller as their validation failure.
  it('passes a non-Zod failure through untouched', () => {
    const exploding = {
      parse: () => {
        throw new TypeError('schema is broken');
      },
    } as unknown as ZodTypeAny;
    const next = jest.fn() as NextFunction & jest.Mock;

    validate(exploding)(mockReq(), mockRes(), next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(TypeError);
    expect(next.mock.calls[0][0]).not.toBeInstanceOf(AppError);
  });
});
