import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../backend/src/app';
import { connectDatabase } from '../backend/src/config/database';
import { env } from '../backend/src/config/env';

/**
 * The serverless entry point.
 *
 * `server.ts` still owns local development and still calls `app.listen`. On a
 * serverless platform nothing listens: the platform owns the socket and hands
 * this function a request that has already been parsed, so the app is exported
 * as a handler instead of bound to a port.
 *
 * The app is built once per instance rather than per request. Constructing the
 * router, the middleware chain and the rate limiter on every invocation would
 * throw away the work a warm instance has already done, and would reset the
 * limiter's in-memory counters on each request — making it no limiter at all.
 */
const app = createApp();

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Answered before the database is touched, so a deployment can be told apart
  // from its dependencies: 200 here with a 503 elsewhere means the function is
  // live and cannot reach Atlas, which is a different problem from a function
  // that never started.
  if (req.url === '/health') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  try {
    await connectDatabase(env.MONGODB_URI);
  } catch (err) {
    // Without this the rejection is unhandled and the caller gets the
    // platform's own opaque 500 with nothing in it to act on.
    // eslint-disable-next-line no-console
    console.error('Database connection failed:', err);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'The service cannot reach its database right now.',
        },
      }),
    );
    return;
  }

  // Express applications are themselves (req, res) handlers, so the platform's
  // request goes straight in and Express routes on the original URL.
  app(req, res);
}
