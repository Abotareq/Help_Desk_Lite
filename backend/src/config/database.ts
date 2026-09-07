import mongoose from 'mongoose';

/**
 * A serverless platform invokes a function per request and may reuse the same
 * process for the next one. Connecting on every invocation would open a fresh
 * pool each time and exhaust the cluster's connection limit inside a single
 * burst of traffic, so the connection is cached and reused.
 *
 * The cache hangs off `globalThis` rather than a module-level variable because
 * a warm instance can re-evaluate a module while keeping the global scope —
 * caching on the module alone would silently reconnect, which is the exact
 * failure this exists to prevent.
 */
interface ConnectionCache {
  /** Which URI the cached connection belongs to. */
  uri: string | null;
  conn: typeof mongoose | null;
  /** The in-flight attempt, so concurrent callers await one connect, not many. */
  promise: Promise<typeof mongoose> | null;
}

/** mongoose.connection.readyState when the socket is actually usable. */
const CONNECTED = 1;

const CONNECT_OPTIONS = {
  // Without this, a query issued before the handshake completes is queued and
  // the invocation sits there until the platform times it out, which reads as a
  // hang rather than as "the database is unreachable".
  bufferCommands: false,

  // A warm instance serves one request at a time, so anything beyond a handful
  // of sockets is idle connections multiplied by however many instances happen
  // to be warm. Atlas caps connections per cluster (500 on M0) and that ceiling
  // is reached by instance count, not by traffic. Raise it only if a single
  // invocation starts doing real concurrent work.
  maxPoolSize: 5,

  serverSelectionTimeoutMS: 10_000,
} as const;

const globalScope = globalThis as typeof globalThis & { __helpdeskMongo?: ConnectionCache };

const cache: ConnectionCache = globalScope.__helpdeskMongo ?? {
  uri: null,
  conn: null,
  promise: null,
};
globalScope.__helpdeskMongo = cache;

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  if (cache.uri === uri) {
    // An attempt for this URI is already in flight, so join it rather than
    // start a second one. This is what stops a cold instance that receives two
    // requests at once from opening two pools.
    if (cache.promise) return cache.promise;

    // A live connection to the same cluster is the whole point of the cache.
    if (cache.conn && mongoose.connection.readyState === CONNECTED) return cache.conn;
  }

  // Everything else needs a real connection: the first call, a call for a
  // different URI, or a cached handle whose socket has since closed. Reusing
  // any of those would hand back an object that fails on its first query, a
  // long way from here and with nothing to point at the cause.
  cache.uri = uri;
  cache.conn = null;

  mongoose.set('strictQuery', true);
  cache.promise = mongoose.connect(uri, CONNECT_OPTIONS).catch((err: unknown) => {
    // A failed attempt must never stay cached. Leaving it would poison the
    // instance for the rest of its life: every later request would await the
    // same rejected promise and fail with a stale error long after the cluster
    // came back.
    cache.promise = null;
    cache.uri = null;
    throw err;
  });

  cache.conn = await cache.promise;
  // Cleared once settled so later callers go through the liveness check above
  // rather than being handed a resolved promise to a socket that has closed.
  cache.promise = null;

  return cache.conn;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  cache.uri = null;
  cache.conn = null;
  cache.promise = null;
}
