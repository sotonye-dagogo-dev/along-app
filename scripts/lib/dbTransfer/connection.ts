/**
 * Connection plumbing for transfer runs.
 *
 * Small on purpose: one pool per run, explicit client checkout for anything
 * transactional (so a load can never accidentally span two backends), and
 * guaranteed release/close in `finally` blocks.
 *
 * Importing this module also installs the raw-text time type parsers the
 * codec depends on — done here, once, so every code path that touches the
 * database gets them.
 */

import { Pool, types, type PoolClient, type QueryResult } from "pg";
import { applyPgTypeOverrides } from "./codec";
import type { Queryable } from "./introspect";

export interface PoolOptions {
  /** Concurrent connections. Loads use 1 — a transaction needs one backend. */
  max?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  applicationName?: string;
}

/** Install the timezone-safe parsers and build a pool. */
export function createTransferPool(connectionString: string, options: PoolOptions = {}): Pool {
  applyPgTypeOverrides(types);
  return new Pool({
    connectionString,
    max: options.max ?? 2,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 15_000,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 60_000,
    application_name: options.applicationName ?? "along-db-transfer",
  });
}

/** Run `fn` on a single checked-out client, always releasing it. */
export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient & Queryable) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client as PoolClient & Queryable);
  } finally {
    client.release();
  }
}

/** Convenience wrapper so callers never leak a pool on failure. */
export async function withPool<T>(
  connectionString: string,
  fn: (pool: Pool) => Promise<T>,
  options: PoolOptions = {},
): Promise<T> {
  const pool = createTransferPool(connectionString, options);
  try {
    return await fn(pool);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

/** Cheap liveness probe used by preflight reports. */
export async function pingDatabase(
  connectionString: string,
  label: string,
): Promise<{ ok: boolean; version?: string; detail: string }> {
  try {
    return await withPool(
      connectionString,
      async (pool) => {
        const result: QueryResult<{ version: string }> = await pool.query(
          "SELECT version() AS version",
        );
        const version = (result.rows[0]?.version ?? "").split(" ").slice(0, 2).join(" ");
        return { ok: true, version, detail: `${label}: connected (${version})` };
      },
      { max: 1, connectionTimeoutMillis: 20_000 },
    );
  } catch (error) {
    return {
      ok: false,
      detail: `${label}: CONNECTION FAILED — ${(error as Error).message}`,
    };
  }
}
