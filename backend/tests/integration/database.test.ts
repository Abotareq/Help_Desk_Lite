import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';

/**
 * This file deliberately does not use tests/setup/testDb.ts — it owns its own
 * server so it can exercise connectDatabase/disconnectDatabase directly rather
 * than the connection the rest of the suite shares.
 */
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  await mongod.stop();
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

describe('connectDatabase', () => {
  it('opens a connection to the given URI', async () => {
    await connectDatabase(mongod.getUri());

    expect(mongoose.connection.readyState).toBe(1);
  });

  it('sets strictQuery, so a stray field in a filter is dropped rather than queried on', async () => {
    await connectDatabase(mongod.getUri());

    expect(mongoose.get('strictQuery')).toBe(true);
  });

  it('rejects rather than hanging when the URI is not a Mongo URI', async () => {
    await expect(connectDatabase('not-a-mongodb-uri')).rejects.toThrow();
  });
});

describe('disconnectDatabase', () => {
  it('closes an open connection', async () => {
    await connectDatabase(mongod.getUri());
    expect(mongoose.connection.readyState).toBe(1);

    await disconnectDatabase();

    expect(mongoose.connection.readyState).toBe(0);
  });

  // The seed script calls it in a finally block, so it has to be safe to call
  // when the connection was never opened or has already gone.
  it('is safe to call when nothing is connected', async () => {
    await expect(disconnectDatabase()).resolves.toBeUndefined();
  });

  it('is safe to call twice', async () => {
    await connectDatabase(mongod.getUri());

    await disconnectDatabase();
    await expect(disconnectDatabase()).resolves.toBeUndefined();
  });
});
