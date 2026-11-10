import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// One pool per server process. In development the module is re-evaluated on
// every hot reload, so the pool is parked on globalThis.
const globalForDb = globalThis as unknown as {
  __sitePool?: Pool;
  __siteDb?: NodePgDatabase<typeof schema>;
};

export function getDb(): NodePgDatabase<typeof schema> {
  if (globalForDb.__siteDb) return globalForDb.__siteDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and start the local database with `npm run db:up`.',
    );
  }

  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
  // An idle client erroring (e.g. the database restarted) must not crash the process.
  pool.on('error', (err) => console.error('[db] idle client error', err.message));

  globalForDb.__sitePool = pool;
  globalForDb.__siteDb = drizzle(pool, { schema });
  return globalForDb.__siteDb;
}
