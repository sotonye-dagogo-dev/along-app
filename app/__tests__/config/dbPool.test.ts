/**
 * @jest-environment node
 *
 * Sprint 77 — runtime DB pool strategy (EMAXCONNSESSION fix):
 * pooler-mode detection, pooler-aware pg adapter options, and the
 * DATABASE_URL-first runtime URL precedence.
 */
import {
  DB_POOL_CONFIG,
  buildPgAdapterOptions,
  isSessionModePoolerUrl,
  isTransactionModePoolerUrl,
} from "@/app/lib/config/dbPool";
import { resolveDatabaseUrl } from "@/app/lib/config/env";

describe("Sprint 77: pooler-mode detection", () => {
  it("flags transaction-mode URLs (port 6543 or pgbouncer=true)", () => {
    expect(
      isTransactionModePoolerUrl(
        "postgresql://user:pass@abc.pooler.supabase.com:6543/postgres?pgbouncer=true"
      )
    ).toBe(true);
    expect(
      isTransactionModePoolerUrl("postgres://user:pass@host:5432/db?pgbouncer=true")
    ).toBe(true);
    expect(
      isTransactionModePoolerUrl("postgres://user:pass@host:5432/db?pgbouncer=false")
    ).toBe(false);
  });

  it("does NOT flag session-mode pooler or direct URLs", () => {
    expect(
      isTransactionModePoolerUrl(
        "postgresql://user:pass@abc.pooler.supabase.com:5432/postgres"
      )
    ).toBe(false);
    expect(
      isTransactionModePoolerUrl("postgresql://user:pass@db.abc.supabase.co:5432/postgres")
    ).toBe(false);
  });

  it("never throws on malformed input and falls back to substring checks", () => {
    expect(isTransactionModePoolerUrl("")).toBe(false);
    expect(isTransactionModePoolerUrl("not a url :6543")).toBe(true);
    expect(isTransactionModePoolerUrl("::::")).toBe(false);
  });

  it("classifies session-mode poolers for the production warn signal", () => {
    expect(
      isSessionModePoolerUrl("postgresql://user:pass@abc.pooler.supabase.com:5432/postgres")
    ).toBe(true);
    expect(
      isSessionModePoolerUrl(
        "postgresql://user:pass@abc.pooler.supabase.com:6543/postgres?pgbouncer=true"
      )
    ).toBe(false);
    expect(isSessionModePoolerUrl("postgresql://user:pass@db.abc.supabase.co:5432/postgres")).toBe(
      false
    );
  });
});

describe("Sprint 77: buildPgAdapterOptions (pooler-aware)", () => {
  const TX_URL =
    "postgresql://user:pass@abc.pooler.supabase.com:6543/postgres?pgbouncer=true";
  const SESSION_URL = "postgresql://user:pass@abc.pooler.supabase.com:5432/postgres";

  it("defaults: small per-instance pool, bounded timeouts, released idle, no prepared stmts in tx mode", () => {
    const opts = buildPgAdapterOptions(TX_URL, {});
    expect(opts.connectionString).toBe(TX_URL);
    expect(opts.max).toBe(DB_POOL_CONFIG.defaultMax);
    expect(opts.connectionTimeoutMillis).toBe(DB_POOL_CONFIG.connectionTimeoutMs);
    expect(opts.idleTimeoutMillis).toBe(DB_POOL_CONFIG.idleTimeoutMs);
    expect(opts.allowExitOnIdle).toBe(true);
    // Transaction-mode Supavisor does NOT support prepared statements.
    expect(opts.prepare).toBe(false);
  });

  it("keeps prepared statements for session-mode/direct URLs (5432)", () => {
    expect(buildPgAdapterOptions(SESSION_URL, {}).prepare).toBe(true);
    expect(
      buildPgAdapterOptions("postgresql://user:pass@db.abc.supabase.co:5432/postgres", {})
        .prepare
    ).toBe(true);
  });

  it("applies env overrides with clamping (invalid values fall back to defaults)", () => {
    expect(buildPgAdapterOptions(TX_URL, { DB_POOL_MAX: "3" }).max).toBe(3);
    expect(buildPgAdapterOptions(TX_URL, { DB_POOL_MAX: "0" }).max).toBe(1); // clamped up
    expect(buildPgAdapterOptions(TX_URL, { DB_POOL_MAX: "999" }).max).toBe(20); // clamped down
    expect(buildPgAdapterOptions(TX_URL, { DB_POOL_MAX: "abc" }).max).toBe(
      DB_POOL_CONFIG.defaultMax
    );
    expect(buildPgAdapterOptions(TX_URL, { DB_CONNECT_TIMEOUT_MS: "2500" }).connectionTimeoutMillis).toBe(
      2500
    );
    expect(buildPgAdapterOptions(TX_URL, { DB_IDLE_TIMEOUT_MS: "not-a-number" }).idleTimeoutMillis).toBe(
      DB_POOL_CONFIG.idleTimeoutMs
    );
  });
});

describe("Sprint 77: resolveDatabaseUrl runtime precedence (DIRECT-last)", () => {
  const ALL = {
    DATABASE_URL: "runtime-tx-url",
    DIRECT_URL: "cli-session-url",
    LOCAL_DB: "dev-runtime-tx-url",
    DIRECT_LOCAL_DB: "dev-cli-session-url",
  };
  const KEYS = Object.keys(ALL) as (keyof typeof ALL)[];

  function withEnv(
    present: Partial<typeof ALL>,
    mode: "production" | "development",
    fn: () => void
  ) {
    const saved: Record<string, string | undefined> = {};
    const GLOBAL_KEYS = [...KEYS, "PROJECT_ENV"] as const;
    for (const k of GLOBAL_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    // getEffectiveEnv(): PROJECT_ENV wins when set — NODE_ENV stays untouched
    // (it is read-only in @types/node) and never consulted while PROJECT_ENV
    // is present.
    process.env.PROJECT_ENV = mode;
    for (const [k, v] of Object.entries(present)) process.env[k] = v as string;
    try {
      fn();
    } finally {
      for (const k of GLOBAL_KEYS) {
        const v = saved[k];
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  it("production prefers DATABASE_URL (transaction mode) over DIRECT_URL (session mode)", () => {
    withEnv(ALL, "production", () => {
      expect(resolveDatabaseUrl()).toBe(ALL.DATABASE_URL);
    });
  });

  it("production falls back DIRECT_URL only when DATABASE_URL is absent", () => {
    withEnv({ DIRECT_URL: ALL.DIRECT_URL, LOCAL_DB: ALL.LOCAL_DB }, "production", () => {
      expect(resolveDatabaseUrl()).toBe(ALL.DIRECT_URL);
    });
  });

  it("development prefers LOCAL_DB over DIRECT_LOCAL_DB", () => {
    withEnv(ALL, "development", () => {
      expect(resolveDatabaseUrl()).toBe(ALL.LOCAL_DB);
    });
  });

  it("development falls back DIRECT_LOCAL_DB only when LOCAL_DB is absent", () => {
    withEnv({ DIRECT_LOCAL_DB: ALL.DIRECT_LOCAL_DB, DATABASE_URL: ALL.DATABASE_URL }, "development", () => {
      expect(resolveDatabaseUrl()).toBe(ALL.DIRECT_LOCAL_DB);
    });
  });

  it("resolves '' when nothing is configured (never throws)", () => {
    withEnv({}, "production", () => {
      expect(resolveDatabaseUrl()).toBe("");
    });
  });
});
