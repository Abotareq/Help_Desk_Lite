/* eslint-disable @typescript-eslint/no-var-requires */
import type { ConnectOptions } from 'mongoose';

interface MongooseMock {
  connect: jest.Mock;
  set: jest.Mock;
  connection: { close: jest.Mock; readyState: number };
}

jest.mock('mongoose', () => {
  // readyState is modelled, not stubbed to a constant: the cache checks it
  // before reusing a connection, so a mock that always claims to be connected
  // would hide exactly the bug this file is here to catch.
  const connection = {
    readyState: 1,
    close: jest.fn(async () => {
      connection.readyState = 0;
    }),
  };
  const mock: MongooseMock = { connect: jest.fn(), set: jest.fn(), connection };
  return { __esModule: true, default: mock, ...mock };
});

const URI = 'mongodb+srv://user:pass@cluster.example.net/helpdesk';

/**
 * The connection is the one piece of this that serverless changes the rules on.
 * A function is invoked per request and its process is reused, so a connect per
 * invocation opens a pool per request and walks into the cluster's connection
 * ceiling under any real burst — which surfaces as timeouts under load and
 * nowhere at all in local testing, where there is only ever one process.
 */
describe('the cached database connection', () => {
  let mongoose: MongooseMock;
  let connectDatabase: (uri: string) => Promise<unknown>;
  let disconnectDatabase: () => Promise<void>;

  beforeEach(() => {
    jest.resetModules();
    // The cache lives on globalThis and would otherwise survive between cases,
    // which is exactly what it is designed to do in production and exactly what
    // makes these assertions meaningless if left in place.
    delete (globalThis as Record<string, unknown>).__helpdeskMongo;

    mongoose = jest.requireMock('mongoose') as MongooseMock;
    mongoose.connection.readyState = 1;
    mongoose.connect.mockResolvedValue({ connection: {} });

    const mod = require('../../../src/config/database');
    connectDatabase = mod.connectDatabase;
    disconnectDatabase = mod.disconnectDatabase;
  });

  it('opens exactly one connection however many times it is asked', async () => {
    await connectDatabase(URI);
    await connectDatabase(URI);
    await connectDatabase(URI);

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
  });

  it('hands every caller the same connection object', async () => {
    const first = await connectDatabase(URI);
    const second = await connectDatabase(URI);

    expect(second).toBe(first);
  });

  // Two requests can land on a cold instance at once. Without a cached promise
  // each would start its own connect, which is the stampede the cache exists to
  // stop — and the case a naive "if (conn) return conn" check misses entirely,
  // because neither has finished by the time the other looks.
  it('collapses concurrent callers onto a single connect', async () => {
    let release: (value: unknown) => void = () => {};
    mongoose.connect.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const all = Promise.all([connectDatabase(URI), connectDatabase(URI), connectDatabase(URI)]);
    release({ connection: {} });
    await all;

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
  });

  // A cached rejection would poison the instance for the rest of its life:
  // every later request would await the same dead promise and fail with a stale
  // error long after the cluster came back.
  it('does not cache a failed attempt', async () => {
    mongoose.connect.mockRejectedValueOnce(new Error('cluster unreachable'));

    await expect(connectDatabase(URI)).rejects.toThrow('cluster unreachable');

    mongoose.connect.mockResolvedValue({ connection: {} });
    await expect(connectDatabase(URI)).resolves.toBeDefined();
    expect(mongoose.connect).toHaveBeenCalledTimes(2);
  });

  it('reconnects after an explicit disconnect rather than returning a closed connection', async () => {
    await connectDatabase(URI);
    await disconnectDatabase();
    await connectDatabase(URI);

    expect(mongoose.connection.close).toHaveBeenCalledTimes(1);
    expect(mongoose.connect).toHaveBeenCalledTimes(2);
  });

  // Both of these were caught by the existing integration suite rather than by
  // this file: the first version of the cache keyed on nothing at all, so it
  // answered every call with whatever it had connected to first.
  it('does not answer a different URI with the connection it already has', async () => {
    await connectDatabase(URI);
    await connectDatabase('mongodb://elsewhere.example.net/other');

    expect(mongoose.connect).toHaveBeenCalledTimes(2);
    expect(mongoose.connect.mock.calls[1]?.[0]).toBe('mongodb://elsewhere.example.net/other');
  });

  it('does not hand back a connection whose socket has since closed', async () => {
    await connectDatabase(URI);

    // Something closed it out from under us — a cluster failover, an idle
    // timeout, or another caller closing the shared mongoose connection.
    mongoose.connection.readyState = 0;
    await connectDatabase(URI);

    expect(mongoose.connect).toHaveBeenCalledTimes(2);
  });

  describe('the options that make it survive serverless', () => {
    it('does not buffer commands, so an unreachable cluster fails instead of hanging', async () => {
      await connectDatabase(URI);

      const options = mongoose.connect.mock.calls[0]?.[1] as ConnectOptions;
      expect(options.bufferCommands).toBe(false);
    });

    // Atlas caps connections per cluster — 500 on M0 — and that ceiling is
    // reached by how many instances are warm, not by how much traffic each one
    // is serving. A large pool per instance spends the budget on idle sockets.
    it('keeps the pool small enough that warm instances do not exhaust the cluster', async () => {
      await connectDatabase(URI);

      const options = mongoose.connect.mock.calls[0]?.[1] as ConnectOptions;
      expect(options.maxPoolSize).toBeLessThanOrEqual(10);
      expect(options.maxPoolSize).toBeGreaterThan(0);
    });
  });
});
