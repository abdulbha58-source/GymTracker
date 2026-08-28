import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzleDb?: NodePgDatabase;
};

// Lazily create the pool/client so importing this module (e.g. during
// Next.js build-time page data collection) doesn't require DATABASE_URL
// to be set. The connection is only established on first query.
function getDb(): NodePgDatabase {
  if (globalForDb.__arenaNextJsDrizzleDb) {
    return globalForDb.__arenaNextJsDrizzleDb;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
    });

  const drizzleDb = drizzle(pool);

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
    globalForDb.__arenaNextJsDrizzleDb = drizzleDb;
  }

  return drizzleDb;
}

export const db: NodePgDatabase = new Proxy({} as NodePgDatabase, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
