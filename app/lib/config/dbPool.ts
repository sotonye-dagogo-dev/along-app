/**
 * Prisma/pg connection-pool configuration (config-driven, zero app deps).
 *
 * Root cause context (Sprint 77): the runtime PrismaClient was resolving the
 * Supabase SESSION-mode pooler (DIRECT_URL, port 5432 — capped at the
 * dashboard "Pool Size", commonly 15 clients per database-role) and opening a
 * pg default pool of 10 connections per warm serverless instance. N instances
 * × 10 ≫ 15 → `DriverAdapterError EMAXCONNSESSION max clients reached in
 * session mode` → 500s across every DB-backed route.
 *
 * Rules encoded here:
 * - The app RUNTIME must prefer the TRANSACTION-mode pooler (port 6543 /
 *   `pgbouncer=true`) — it multiplexes hundreds of serverless clients onto a
 *   small server-side pool. Session-mode/direct URLs are for Prisma CLI
 *   (migrations, seeds) only.
 * - Per-instance pool stays SMALL on serverless (default 5, `DB_POOL_MAX`
 *   override) — Supabase guidance is 1–5; transaction mode makes more local
 *   connections pure overhead.
 * - A connect timeout (default 5s) keeps a dead pooler from eating the whole
 *   Vercel function budget; idle sockets are released (`allowExitOnIdle`) so
 *   frozen lambdas don't pin pooler sessions.
 * - Transaction-mode Supavisor does NOT support prepared statements — node-
 *   pg must run with `prepare: false` there (the `?pgbouncer=true` URL param
 *   is a classic-engine switch and is ignored by the pg driver).
 */

export interface DbPoolConfig {
  /** Per-instance max connections (serverless: small on purpose). */
  defaultMax: number;
  /** Milliseconds to wait for a NEW TCP connection before failing. */
  connectionTimeoutMs: number;
  /** Milliseconds an idle connection is kept before being closed. */
  idleTimeoutMs: number;
  /** Ports that always mean a transaction-mode pooler. */
  transactionModePorts: number[];
  /** Query param that flags transaction mode (classic-engine convention). */
  transactionModeParam: string;
}

export const DB_POOL_CONFIG: DbPoolConfig = {
  defaultMax: 5,
  connectionTimeoutMs: 5000,
  idleTimeoutMs: 10000,
  transactionModePorts: [6543],
  transactionModeParam: "pgbouncer",
};

/** Normalized pg adapter options consumed by `PrismaPg`. */
export interface PgAdapterOptions {
  connectionString: string;
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  allowExitOnIdle: boolean;
  /** false = no prepared statements (required against transaction-mode PgBouncer). */
  prepare: boolean;
}

function clampInt(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  const n = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/**
 * True when the URL targets a TRANSACTION-mode pooler (Supavisor 6543,
 * `pgbouncer=true`, or any `?pgbouncer=` flag). Session-mode poolers
 * (Supabase 5432 pooler host, Prisma `pooled.db.prisma.io`) and direct
 * connections return false — they keep prepared statements.
 */
export function isTransactionModePoolerUrl(url: string): boolean {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    const port = Number.parseInt(parsed.port || "", 10);
    if (DB_POOL_CONFIG.transactionModePorts.includes(port)) return true;
    const flag = parsed.searchParams.get(DB_POOL_CONFIG.transactionModeParam);
    if (flag !== null && flag !== "false" && flag !== "0") return true;
    return false;
  } catch {
    // Unparseable — fall back to cheap substring checks so a malformed URL
    // never silently disables the safety switch.
    return (
      /:\d*6543(\/|$)/.test(trimmed) ||
      new RegExp(`[?&]${DB_POOL_CONFIG.transactionModeParam}=true`, "i").test(trimmed)
    );
  }
}

/**
 * Pooler-aware pg options for the runtime PrismaClient adapter.
 * Env overrides: `DB_POOL_MAX` (1–20), `DB_CONNECT_TIMEOUT_MS` (500–15000),
 * `DB_IDLE_TIMEOUT_MS` (1000–120000). Invalid/absent values use defaults.
 */
export function buildPgAdapterOptions(
  connectionString: string,
  env: Record<string, string | undefined> = process.env
): PgAdapterOptions {
  return {
    connectionString,
    max: clampInt(env.DB_POOL_MAX, 1, 20, DB_POOL_CONFIG.defaultMax),
    connectionTimeoutMillis: clampInt(
      env.DB_CONNECT_TIMEOUT_MS,
      500,
      15000,
      DB_POOL_CONFIG.connectionTimeoutMs
    ),
    idleTimeoutMillis: clampInt(env.DB_IDLE_TIMEOUT_MS, 1000, 120000, DB_POOL_CONFIG.idleTimeoutMs),
    allowExitOnIdle: true,
    prepare: !isTransactionModePoolerUrl(connectionString),
  };
}

/**
 * True when the URL is a SESSION-mode pooler that caps concurrent clients at
 * a small pool-size (the EMAXCONNSESSION shape). Used only for a one-time
 * production warning — never for control flow.
 */
export function isSessionModePoolerUrl(url: string): boolean {
  if (isTransactionModePoolerUrl(url)) return false;
  try {
    const parsed = new URL((url ?? "").trim());
    if (!parsed.hostname) return false;
    return (
      parsed.hostname.includes("pooler.supabase.com") ||
      parsed.hostname.startsWith("pooled.") ||
      parsed.hostname.includes(".pooler.")
    );
  } catch {
    return /pooler\.|pooled\./i.test(url ?? "");
  }
}
