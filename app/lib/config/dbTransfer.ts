/**
 * DB transfer registry — single source of truth for the local ⇄ Supabase ⇄
 * legacy-Prisma backup / migration tooling under `scripts/db-*.ts`.
 *
 * Everything that a transfer run decides (which env var resolves a role,
 * where files land, how "recent" a resumable backup is, how big an INSERT
 * batch gets, which tables are bookkeeping, every line of operator feedback)
 * is declared here so the scripts stay mechanics-only.
 *
 * Pure module: no `pg`, no `fs`, no Node-only APIs — safe to import from
 * app code, tests, and scripts alike.
 */

/* ------------------------------------------------------------------ *
 * Roles / endpoints
 * ------------------------------------------------------------------ */

/** A real database the tooling can connect to. */
export type DbRole = "legacy" | "supabase";

/**
 * An endpoint a transfer can be aimed at. `"local"` is the pseudo-target
 * used for "this backup only lands on disk" runs (safety snapshots).
 */
export type DbEndpoint = DbRole | "local";

/**
 * sslmode tokens `pg` understands. `no-verify` is the pg-specific token
 * that maps to `ssl: { rejectUnauthorized: false }`.
 */
export type DbSslMode = "require" | "no-verify" | "verify-ca" | "verify-full" | "prefer" | "allow" | "disable";

export interface DbRoleConfig {
  key: DbRole;
  /** Human label used in every operator-facing line. */
  label: string;
  /** Short label used in file names. */
  short: string;
  /**
   * Env vars consulted IN ORDER to find this role's connection URL.
   * The first one that is set and non-empty wins.
   *
   * `DB_BACKUP_*` entries exist as explicit one-off overrides so a run can
   * be pointed at a specific host without editing `.env`.
   */
  envUrlCandidates: string[];
  /**
   * Schemes `pg` can actually speak. `prisma+postgres://` (Prisma
   * Accelerate) is NOT one of them — it needs `accelerateUrl` on the
   * PrismaClient, not a SQL socket.
   */
  allowedSchemes: string[];
  /**
   * Host suffixes that must be reached over TLS, and WHICH sslmode to use
   * for each. Longest matching suffix wins.
   *
   * `require` verifies the certificate chain. `no-verify` encrypts the
   * connection but skips chain verification. These are NOT interchangeable:
   * Supabase's pooler sends a self-signed root in its chain that Node
   * cannot validate, so `sslmode=require` there fails outright with
   * "self-signed certificate in certificate chain" — `no-verify` is the
   * only mode that both encrypts and works (verified empirically against
   * aws-1-eu-west-2.pooler.supabase.com:5432).
   */
  sslModes: readonly { suffix: string; mode: DbSslMode; note: string }[];
  /** Where the running app resolves this role (documentation only). */
  appEnvVars: string[];
}

/* ------------------------------------------------------------------ *
 * Journal stages
 * ------------------------------------------------------------------ */

/**
 * Canonical ordered stage vocabulary. A script declares the subset it
 * uses; the journal records which of those have completed, which is what
 * makes an interrupted run resumable instead of restarting from zero.
 *
 * Order matters — `nextStage()` walks this list.
 */
export const DB_STAGES = [
  /** Source dumped to a local, checksummed, atomically-renamed file. */
  "backup-created",
  /** Target inspected; pre-state snapshot recorded (clear decision basis). */
  "target-inspected",
  /** Non-empty target safety-dumped before any destructive step. */
  "target-safety-backup",
  /** Target schema exists (migrations applied / already present). */
  "schema-ready",
  /** Load transaction COMMITTED (verification happens after this). */
  "loaded",
  /** Row counts + content hashes re-read from the target and matched. */
  "verified",
  /** Backup is now officially used; never reused for resume again. */
  "consumed",
] as const;

export type DbStage = (typeof DB_STAGES)[number];

/** Ordered list of stages a given operation walks through. */
export type DbStagePlan = readonly DbStage[];

export interface DbStageRecord {
  at: string;
  note?: string;
  meta?: Record<string, unknown>;
}

export interface DbTransferJournalEntry {
  id: string;
  direction: { source: DbEndpoint; target: DbEndpoint };
  /** Path to the dump file, relative to the project root. */
  file: string;
  createdAt: string;
  updatedAt: string;
  stages: Partial<Record<DbStage, DbStageRecord>>;
}

export interface DbTransferJournal {
  version: number;
  updatedAt: string;
  entries: DbTransferJournalEntry[];
}

/* ------------------------------------------------------------------ *
 * The registry
 * ------------------------------------------------------------------ */

export const DB_TRANSFER_CONFIG = {
  format: "along-db-backup" as const,
  formatVersion: 1,

  /** Where dumps + the resume journal live (gitignored via `/backups/`). */
  directory: "backups/db-transfer",
  journalFile: "backups/db-transfer/state.json",

  /**
   * Legacy Prisma Postgres is reachable only through a real SQL socket.
   * Order matters: explicit override first, then the renamed production
   * direct URL, then the dev direct URL.
   */
  roles: {
    legacy: {
      key: "legacy",
      label: "Prisma Postgres (legacy)",
      short: "legacy",
      envUrlCandidates: [
        "DB_BACKUP_LEGACY_URL",
        "PREVIOUS_DIRECT_URL",
        "DIRECT_LOCAL_DB",
        "PREVIOUS_DATABASE_URL",
      ],
      allowedSchemes: ["postgres", "postgresql"],
      // Prisma's own certificates chain to a real public root, so full
      // verification works here and should be kept on.
      sslModes: [
        {
          suffix: ".prisma.io",
          mode: "require",
          note: "Prisma's cert chains to a public root — verified TLS.",
        },
        {
          suffix: ".prisma.data.net",
          mode: "require",
          note: "Prisma's cert chains to a public root — verified TLS.",
        },
      ],
      appEnvVars: ["PREVIOUS_DIRECT_URL", "PREVIOUS_DATABASE_URL"],
    },
    supabase: {
      key: "supabase",
      label: "Supabase (primary)",
      short: "supabase",
      // DIRECT_URL (session-mode pooler, port 5432) beats DATABASE_URL
      // (transaction-mode pooler, port 6543) for bulk loads + DDL: a
      // session-mode backend owns its prepared statements and advisory
      // locks for the whole connection, which is what a long load wants.
      envUrlCandidates: [
        "DB_BACKUP_SUPABASE_URL",
        "DIRECT_URL",
        "DATABASE_URL",
        "DIRECT_LOCAL_DB",
        "LOCAL_DB",
      ],
      allowedSchemes: ["postgres", "postgresql"],
      // Supabase's pooler presents a self-signed root inside its chain.
      // `require`/`verify-ca` therefore FAIL against it (Node rejects the
      // chain), while `no-verify` succeeds over TLS. Plaintext also happens
      // to be accepted by the pooler, but silently degrades the link — so
      // this tool forces encrypted `no-verify` rather than leaving the URL
      // untouched.
      sslModes: [
        {
          suffix: ".supabase.com",
          mode: "no-verify",
          note: "Supabase pooler sends a self-signed root — verified TLS is impossible, encrypted `no-verify` used instead.",
        },
        {
          suffix: ".supabase.co",
          mode: "no-verify",
          note: "Supabase sends a self-signed root — verified TLS is impossible, encrypted `no-verify` used instead.",
        },
      ],
      appEnvVars: ["DATABASE_URL", "DIRECT_URL"],
    },
  } satisfies Record<DbRole, DbRoleConfig>,

  /**
   * Development aliases that `resolveDatabaseUrl()` / `prisma.config.ts`
   * prefer when PROJECT_ENV !== production. If these still point at the
   * legacy DB after cutover, dev runs silently talk to the wrong database
   * — the scripts warn about it before doing anything.
   */
  devAliasEnvVars: ["DIRECT_LOCAL_DB", "LOCAL_DB"],

  /** Prisma's own migration bookkeeping — backed up, never restored. */
  bookkeepingTables: ["_prisma_migrations"] as const,
  /** Public-schema tables that `prisma migrate deploy` owns. */
  expectedBookkeepingTable: "_prisma_migrations",

  resume: {
    /**
     * "Extremely recent" — a completed-but-unconsumed backup older than
     * this is ignored and a fresh one is taken instead.
     */
    freshnessMinutes: 120,
    /** Re-verify sha256 + per-table hashes before trusting a resume file. */
    verifyIntegrityOnResume: true,
    /** Override via `DB_BACKUP_FRESHNESS_MINUTES`. */
    envKey: "DB_BACKUP_FRESHNESS_MINUTES",
  },

  dump: {
    /** Rows per `{"kind":"rows"}` line — bounds peak write buffering. */
    rowsPerChunk: 500,
  },

  insert: {
    /** Starting rows per INSERT; auto-shrunk to fit the bind-parameter cap. */
    rowsPerBatch: 400,
    /**
     * Postgres hard-caps a statement at 65535 bind parameters. Batch size
     * is clamped to `floor(maxBindParams / columnCount)` before every run.
     */
    maxBindParams: 60000,
    statementTimeoutMs: 0,
  },

  verify: {
    /**
     * `full`  — re-read every row and compare per-table content hashes.
     * `counts` — row counts only (cheap escape hatch for very large tables).
     */
    mode: "full" as "full" | "counts",
    envKey: "DB_BACKUP_VERIFY_MODE",
    /**
     * Content hashing sorts canonical row strings in memory; tables above
     * this row count degrade to count-only verification with a warning.
     */
    maxRowsForContentHash: 200000,
  },

  /** Sequence resync after an explicit-id load (`MAX(id)` + `setval`). */
  syncSequences: true,

  /**
   * The safety net for `--replace`: a full local dump of the TARGET must
   * succeed before a single byte of it is cleared.
   */
  safetyBackup: {
    enabled: true,
    envKey: "DB_BACKUP_SAFETY_BACKUP",
  },

  retention: {
    /** Oldest journal entries are pruned beyond this. */
    maxEntries: 40,
    /** Consumed entries older than this are dropped on the next write. */
    consumedTtlDays: 30,
  },

  /** Ordered stage plans per command. */
  plans: {
    /** `db:migrate-supabase` — legacy → Supabase one-shot cutover. */
    migrate: [
      "backup-created",
      "target-inspected",
      "target-safety-backup",
      "schema-ready",
      "loaded",
      "verified",
      "consumed",
    ] as const satisfies DbStagePlan,
    /** `db:backup-local` — dump a role to disk, nothing else. */
    backup: ["backup-created"] as const satisfies DbStagePlan,
    /** `db:restore-local` — load a file into a role. */
    restore: [
      "target-inspected",
      "target-safety-backup",
      "schema-ready",
      "loaded",
      "verified",
      "consumed",
    ] as const satisfies DbStagePlan,
    /** `db:backup-supabase` — Supabase → local, then Supabase → legacy. */
    mirror: [
      "backup-created",
      "target-inspected",
      "target-safety-backup",
      "schema-ready",
      "loaded",
      "verified",
      "consumed",
    ] as const satisfies DbStagePlan,
  },

  /** Guard rails for destructive operations. */
  destructive: {
    /**
     * A non-empty target may only be cleared when the operator passes
     * this flag — and even then only after its safety backup succeeded.
     */
    replaceFlag: "replace",
    /** `--yes` is accepted as an alias so runs stay scriptable. */
    aliasFlags: ["yes"],
  },

  /**
   * Flags that CONSUME the following token as their value. Everything else
   * is a boolean.
   *
   * This list is what stops `--replace backup.jsonl` from swallowing the
   * positional argument: a bare flag must never eat its neighbour.
   */
  flags: {
    valueFlags: [
      "source",
      "target",
      "file",
      "source-url",
      "target-url",
      "verify-mode",
      "dir",
    ],
    booleanFlags: [
      "replace",
      "yes",
      "force",
      "fresh",
      "check",
      "dry-run",
      "quiet",
      "help",
    ],
  },

  /** Every operator-facing string — so copy never lives in the scripts. */
  copy: {
    banner: (title: string) => `\n=== ${title} ===`,
    step: (index: number, total: number, label: string) =>
      `[${index}/${total}] ${label}`,
    done: (label: string, ms: number) =>
      `✔ ${label} (${(ms / 1000).toFixed(1)}s)`,
    warn: (message: string) => `⚠ ${message}`,
    fail: (message: string) => `✖ ${message}`,
    info: (message: string) => `  ${message}`,
    tableRow: (name: string, rows: number | string) =>
      `  ${String(name).padEnd(28)} ${String(rows).padStart(10)}`,
    progress: (label: string, done: number, total: number) => {
      const pct = total > 0 ? Math.floor((done / total) * 100) : 100;
      const bar = "█".repeat(Math.floor(pct / 5)).padEnd(20, "░");
      return `  ${bar} ${String(pct).padStart(3)}%  ${label} (${done}/${total})`;
    },
    resumeFound: (id: string, stage: DbStage, ageMinutes: number) =>
      `Reusing recent uncorrupted backup "${id}" — resuming at stage "${stage}" (${Math.round(ageMinutes)} min old).`,
    resumeNone: (reason: string) =>
      `No resumable backup found (${reason}) — taking a fresh one.`,
    integrityOk: (rows: number, tables: number) =>
      `Integrity verified: ${rows} rows across ${tables} tables, sha256 matched.`,
    integrityFail: (detail: string) => `Backup integrity check FAILED: ${detail}`,
    cleared: (tables: number) =>
      `Target cleared (${tables} tables) inside the load transaction — rollback restores it if anything fails.`,
    skippedClear: "Target already empty — nothing to clear.",
    rollback: "Load rolled back — target database is exactly as it was before this run.",
    safetyOk: (file: string) => `Safety backup of the target written: ${file}`,
    safetyMissing: "Refusing to clear a non-empty target: no safety backup was taken.",
    waiting: (label: string) => `… ${label}`,
    summary: (rows: number, tables: number, ms: number) =>
      `Transferred ${rows} rows across ${tables} tables in ${(ms / 1000).toFixed(1)}s.`,
  },
} as const;

export type DbTransferConfig = typeof DB_TRANSFER_CONFIG;

/* ------------------------------------------------------------------ *
 * File naming
 * ------------------------------------------------------------------ */

/** `2026-10-17T10:15:00.123Z` → `2026-10-17T10-15-00-123Z` (filesystem-safe). */
export function fileSafeTimestamp(at: Date | string = new Date()): string {
  const iso = typeof at === "string" ? at : at.toISOString();
  return iso.replace(/[:.]/g, "-");
}

/**
 * Deterministic, sortable dump name:
 * `<source>-to-<target>-<ISO compact>.jsonl`
 */
export function backupFileName(params: {
  source: DbEndpoint;
  target: DbEndpoint;
  at?: Date | string;
}): string {
  const source = DB_TRANSFER_CONFIG.roles[params.source as DbRole]?.short ?? params.source;
  const target = DB_TRANSFER_CONFIG.roles[params.target as DbRole]?.short ?? params.target;
  return `${source}-to-${target}-${fileSafeTimestamp(params.at)}.jsonl`;
}

/** Journal entry id — the same value as the file stem, so they pair up. */
export function backupId(fileName: string): string {
  return fileName.replace(/\.jsonl$/, "");
}

/* ------------------------------------------------------------------ *
 * Journal helpers (pure)
 * ------------------------------------------------------------------ */

export function stagesCompleted(entry: DbTransferJournalEntry): DbStage[] {
  return DB_STAGES.filter((stage) => entry.stages[stage]);
}

/** First stage of `plan` that the entry has NOT recorded yet. */
export function nextStage(
  plan: DbStagePlan,
  entry: DbTransferJournalEntry | null,
): DbStage | null {
  if (!entry) return plan[0] ?? null;
  for (const stage of plan) {
    if (!entry.stages[stage]) return stage;
  }
  return null;
}

/** True once the entry has every stage of `plan` (i.e. the run finished). */
export function isPlanComplete(
  plan: DbStagePlan,
  entry: DbTransferJournalEntry | null,
): boolean {
  return nextStage(plan, entry) === null;
}

export interface ResumeDecision {
  resumable: boolean;
  reason: string;
  stage: DbStage | null;
  ageMinutes: number;
}

/**
 * Should this entry be picked up instead of starting over?
 *
 * Rules (all must hold):
 *  1. same direction as the requested run,
 *  2. NOT already `consumed` (that is the "was used" signal),
 *  3. has a dump file recorded,
 *  4. younger than `resume.freshnessMinutes` — "extremely recent",
 *  5. not already complete (a finished run is never replayed).
 */
export function evaluateResume(params: {
  entry: DbTransferJournalEntry | null;
  direction: { source: DbEndpoint; target: DbEndpoint };
  plan: DbStagePlan;
  now?: Date;
  freshnessMinutes?: number;
}): ResumeDecision {
  const { entry, direction, plan } = params;
  const now = params.now ?? new Date();
  const fresh =
    params.freshnessMinutes ?? DB_TRANSFER_CONFIG.resume.freshnessMinutes;
  const base = { stage: null as DbStage | null, ageMinutes: 0 };

  if (!entry) {
    return { ...base, resumable: false, reason: "no prior run recorded" };
  }
  if (
    entry.direction.source !== direction.source ||
    entry.direction.target !== direction.target
  ) {
    return { ...base, resumable: false, reason: "different direction" };
  }
  if (entry.stages.consumed) {
    return { ...base, resumable: false, reason: "backup already consumed" };
  }
  if (!entry.file) {
    return { ...base, resumable: false, reason: "no dump file recorded" };
  }
  if (isPlanComplete(plan, entry)) {
    return { ...base, resumable: false, reason: "prior run already complete" };
  }

  const ageMs = now.getTime() - new Date(entry.updatedAt).getTime();
  const ageMinutes = Number.isFinite(ageMs) ? ageMs / 60000 : Number.POSITIVE_INFINITY;
  if (ageMinutes > fresh) {
    return {
      ...base,
      ageMinutes,
      resumable: false,
      reason: `older than the ${fresh}-minute freshness window`,
    };
  }

  return {
    resumable: true,
    reason: "recent, complete-but-unused backup",
    stage: nextStage(plan, entry),
    ageMinutes: Math.max(0, ageMinutes),
  };
}

/* ------------------------------------------------------------------ *
 * Redaction / fingerprints (pure string helpers — never log secrets)
 * ------------------------------------------------------------------ */

/**
 * Strip credentials from a connection string. Safe to print.
 * `postgresql://user:pass@host/db` → `postgresql://***:***@host/db`
 */
export function redactConnectionString(url: string): string {
  if (!url) return "<unset>";
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = "***";
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return url.replace(/\/\/([^/@\s]+):([^/@\s]*)@/g, "//***:***@")
      .replace(/\/\/([^/@\s]+)@/g, "//***@");
  }
}

export interface ConnectionFingerprint {
  scheme: string;
  host: string;
  port: string;
  database: string;
}

/** Host/db identity of a URL — enough to tell two databases apart, no secrets. */
export function fingerprintConnection(url: string): ConnectionFingerprint | null {
  try {
    const parsed = new URL(url);
    return {
      scheme: parsed.protocol.replace(/:$/, ""),
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol.startsWith("postgres") ? "5432" : ""),
      database: parsed.pathname.replace(/^\//, ""),
    };
  } catch {
    return null;
  }
}

/** One-line, secret-free description used in preflight reports. */
export function describeConnection(url: string): string {
  const fp = fingerprintConnection(url);
  if (!fp) return redactConnectionString(url);
  return `${fp.scheme}://${fp.host}:${fp.port}/${fp.database}`;
}
