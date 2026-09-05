import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { buildApiRouter } from './api/routes';
import { errorHandler, notFoundHandler } from './infrastructure/middlewares/errorHandler';

/**
 * Builds the Express app without binding a port, so integration tests can hand
 * it straight to supertest. `server.ts` owns the listening.
 */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api', buildApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
