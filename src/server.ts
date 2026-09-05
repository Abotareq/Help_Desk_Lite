import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';

async function start(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);
  // eslint-disable-next-line no-console
  console.log('Connected to MongoDB');

  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`HelpDesk Lite API listening on http://localhost:${env.PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
