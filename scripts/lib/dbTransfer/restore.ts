/**
 * Schema preparation + the single-transaction load.
 *
 * ── Integrity model ────────────────────────────────────────────────────
 * Everything that mutates the target happens inside ONE transaction:
 *
 *     BEGIN → [TRUNCATE] → INSERTs → deferred-FK UPDATEs → sequence sync
 *           → re-read + verify → COMMIT   (any error → ROLLBACK)
 *
 * Verification runs BEFORE the commit, so a database that comes out wrong
 * is impossible to end up with: a mismatch rolls the target back to exactly
 * the state it had when the run started. The load is "all or nothing" —
 * that is the rollback guarantee the directive asks for.
 *
 * ── Cyclic foreign keys ───────────────────────────────────────────────
 * `Post.quotedPostId` and `User.invitedById` point at rows of their own
 * table, so no row order can satisfy them. Those columns are declared in
 * the header's `cyclicFks`; pass 1 writes them NULL, pass 2 restores the
 * real values once every row exists.
 *
 * ── Schema creation ───────────────────────────────────────────────────
 * Schema is owned by Prisma migrations, not by this tool: an empty target
 * gets `prisma migrate deploy` with all four datasource env vars pointed
 * at the target, so `prisma.config.ts` can never pick the wrong database.
 */

import { spawnSync } from "node:child_process";
import type { Pool, PoolClient } from "pg";
import { DB_TRANSFER_CONFIG } from "../../../app/lib/config/dbTransfer";
import { rowToParams } from "./codec";
import type { TransferLog } from "./log";
import {
  introspectTables,
  listTables,
  quoteIdent,
  quoteIdents,
  restorableTables,
  type Queryable,
} from "./introspect";
import { forEachRowsLine } from "./read";
import type { BackupFooter, BackupHeader, BackupTableSchema, TransferSummary } from "./types";
import { TransferSafetyError } from "./types";
import { verifyTargetAgainstBackup, type VerifyOutcome } from "./verify";

/* ------------------------------------------------------------------ *
 * Schema diff
 * ------------------------------------------------------------------ */

export type SchemaState = "absent" | "complete" | "partial";

export interface SchemaDiff {
  state: SchemaState;
  required: string[];
  present: string[];
  missing: string[];
  /** Tables on the target the backup knows nothing about (left untouched). */
  extra: string[];
  /** Source columns absent on the target that may safely become NULL. */
  nullableColumnDrops: Array<{ table: string; column: string }>;
  /** Source columns absent on the target that would lose NOT NULL data. */
  fatalColumnDrops: Array<{ table: string; column: string }>;
  /** Target columns the backup does not carry (filled by default/NULL). */
  columnGains: Array<{ table: string; column: string }>;
  /** Human-readable blockers. */
  fatal: string[];
}

export function diffSchema(
  header: BackupHeader,
  targetTables: readonly BackupTableSchema[],
  targetTableNames: readonly string[],
): SchemaDiff {
  const required = restorableTables(header).map((t) => t.name);
  const targetByName = new Map(targetTables.map((t) => [t.name, t]));
  const presentSet = new Set(targetTableNames);

  const present = required.filter((n) => presentSet.has(n));
  const missing = required.filter((n) => !presentSet.has(n));
  const extra = targetTableNames.filter(
    (n) => !required.includes(n) && !(DB_TRANSFER_CONFIG.bookkeepingTables as readonly string[]).includes(n),
  );

  const nullableColumnDrops: SchemaDiff["nullableColumnDrops"] = [];
  const fatalColumnDrops: SchemaDiff["fatalColumnDrops"] = [];
  const columnGains: SchemaDiff["columnGains"] = [];

  for (const table of restorableTables(header)) {
    const target = targetByName.get(table.name);
    if (!target) continue;
    const targetCols = new Map(target.columns.map((c) => [c.name, c]));
    const sourceCols = new Set(table.columns.map((c) => c.name));

    for (const column of table.columns) {
      if (targetCols.has(column.name)) continue;
      if (column.isNullable) nullableColumnDrops.push({ table: table.name, column: column.name });
      else fatalColumnDrops.push({ table: table.name, column: column.name });
    }
    for (const column of target.columns) {
      if (sourceCols.has(column.name)) continue;
      if (!column.isNullable && !column.hasDefault) {
        fatalColumnDrops.push({
          table: table.name,
          column: `${column.name} (new on target, NOT NULL, no default)`,
        });
      } else {
        columnGains.push({ table: table.name, column: column.name });
      }
    }
  }

  const state: SchemaState =
    missing.length === 0 ? "complete" : present.length === 0 ? "absent" : "partial";

  const fatal: string[] = [];
  if (fatalColumnDrops.length > 0) {
    fatal.push(
      `incompatible columns: ${fatalColumnDrops
        .map((d) => `${d.table}.${d.column}`)
        .join(", ")}`,
    );
  }
  if (state === "partial") {
    fatal.push(
      `target schema is partially applied (present: ${present.length}/${required.length}; ` +
        `missing: ${missing.join(", ")})`,
    );
  }

  return {
    state,
    required,
    present,
    missing,
    extra,
    nullableColumnDrops,
    fatalColumnDrops,
    columnGains,
    fatal,
  };
}

/** Short operator-facing summary of a diff. */
export function describeSchemaDiff(diff: SchemaDiff): string[] {
  const lines = [`schema state: ${diff.state} (${diff.present.length}/${diff.required.length} tables present)`];
  if (diff.missing.length) lines.push(`missing tables: ${diff.missing.join(", ")}`);
  if (diff.extra.length) lines.push(`extra tables: ${diff.extra.join(", ")}`);
  if (diff.fatal.length) lines.push(`blocked: ${diff.fatal.join("; ")}`);
  return lines;
}

/* ------------------------------------------------------------------ *
 * Schema creation
 * ------------------------------------------------------------------ */

/**
 * Run Prisma's authoritative migration flow against an explicit URL.
 *
 * All four datasource names are overridden so `prisma.config.ts` resolves
 * the target regardless of whether PROJECT_ENV says development (which
 * prefers `DIRECT_LOCAL_DB`/`LOCAL_DB`) or production (which prefers
 * `DIRECT_URL`).
 */
export function runPrismaMigrateDeploy(targetUrl: string, log: TransferLog): void {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DIRECT_URL: targetUrl,
    DATABASE_URL: targetUrl,
    DIRECT_LOCAL_DB: targetUrl,
    LOCAL_DB: targetUrl,
  };
  const isWindows = process.platform === "win32";
  log.info("Applying Prisma migrations to the target (prisma migrate deploy) …");

  const result = spawnSync(isWindows ? "npx.cmd" : "npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    shell: isWindows,
  });

  if (result.error) {
    throw new Error(`Could not launch \`npx prisma migrate deploy\`: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `\`prisma migrate deploy\` exited with code ${result.status ?? "unknown"} — the target schema could not be prepared.`,
    );
  }
}

/** Drop every relation in `public` so migrations can be applied cleanly. */
async function dropAllPublicRelations(client: Queryable, log: TransferLog): Promise<void> {
  const result = await client.query<{ name: string; kind: string }>(
    `SELECT c.relname AS name, c.relkind AS kind
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f')`,
  );
  if (result.rows.length === 0) return;

  const tables = result.rows.filter((r) => r.kind !== "v").map((r) => r.name);
  const views = result.rows.filter((r) => r.kind === "v").map((r) => r.name);

  log.warn(`Dropping ${result.rows.length} existing relation(s) so migrations can be re-applied.`);
  if (views.length > 0) {
    await client.query(`DROP VIEW IF EXISTS ${views.map(quoteIdent).join(", ")} CASCADE`);
  }
  if (tables.length > 0) {
    await client.query(`DROP TABLE IF EXISTS ${tables.map(quoteIdent).join(", ")} CASCADE`);
  }
}

export interface EnsureSchemaParams {
  pool: Pool;
  header: BackupHeader;
  targetUrl: string;
  /** `--replace` — permit dropping a partially-created target schema. */
  allowDrop: boolean;
  log: TransferLog;
}

export interface EnsureSchemaResult {
  diff: SchemaDiff;
  created: boolean;
  dropped: boolean;
  bookkeepingMissing: boolean;
}

/** Inspect → (create | drop+create) → re-inspect → assert complete. */
export async function ensureSchema(params: EnsureSchemaParams): Promise<EnsureSchemaResult> {
  const { pool, header, targetUrl, allowDrop, log } = params;
  const bookkeeping = DB_TRANSFER_CONFIG.expectedBookkeepingTable;

  const inspect = async () => {
    const names = await listTables(pool);
    const schemas = await introspectTables(pool);
    return { names, diff: diffSchema(header, schemas, names) };
  };

  let { diff, names } = await inspect();
  let created = false;
  let dropped = false;

  if (diff.state === "absent") {
    runPrismaMigrateDeploy(targetUrl, log);
    created = true;
    ({ diff, names } = await inspect());
    if (diff.state !== "complete") {
      throw new Error(
        `Migrations ran but the target schema is still incomplete (missing: ${
          diff.missing.join(", ") || "none reported"
        }). Check the migrate output above.`,
      );
    }
  } else if (diff.state === "partial") {
    if (!allowDrop) {
      throw new TransferSafetyError(
        `Target schema is only partially applied (${diff.present.length}/${diff.required.length} tables present). ` +
          "Loading into it could not be verified.",
        `Inspect the target, or re-run with --${DB_TRANSFER_CONFIG.destructive.replaceFlag} to drop and rebuild ` +
          "its schema (a safety backup of the target is taken first).",
      );
    }
    await dropAllPublicRelations(pool, log);
    dropped = true;
    runPrismaMigrateDeploy(targetUrl, log);
    created = true;
    ({ diff, names } = await inspect());
    if (diff.state !== "complete") {
      throw new Error(`Schema rebuild did not produce a complete target (missing: ${diff.missing.join(", ")}).`);
    }
  }

  // Column-level incompatibility on an otherwise-complete schema still
  // blocks the load — there is no safe default for missing NOT NULL data.
  if (diff.fatal.length > 0) {
    throw new TransferSafetyError(
      `Schema is incompatible with the backup: ${diff.fatal.join("; ")}`,
      "Align the two schemas (apply the missing migration on the target, or restore a matching backup).",
    );
  }

  const bookkeepingMissing = !names.includes(bookkeeping);
  if (diff.state === "complete" && bookkeepingMissing) {
    log.warn(
      `${bookkeeping} is absent — the target has tables but no migration history. ` +
        "A future \`npm run db:migrate\` would try to re-create them; run `npx prisma migrate resolve --applied <name>` if needed.",
    );
  }
  if (diff.extra.length > 0) {
    log.warn(`Target has ${diff.extra.length} table(s) not in the backup (left untouched): ${diff.extra.join(", ")}`);
  }
  if (diff.nullableColumnDrops.length > 0) {
    log.warn(
      `Backup carries ${diff.nullableColumnDrops.length} column(s) the target lacks — loaded as NULL: ` +
        diff.nullableColumnDrops.map((d) => `${d.table}.${d.column}`).join(", "),
    );
  }
  if (diff.columnGains.length > 0) {
    log.info(
      `Target has ${diff.columnGains.length} newer column(s) filled from defaults: ` +
        diff.columnGains.map((d) => `${d.table}.${d.column}`).join(", "),
    );
  }

  return { diff, created, dropped, bookkeepingMissing };
}

/* ------------------------------------------------------------------ *
 * Load
 * ------------------------------------------------------------------ */

export interface LoadParams {
  client: PoolClient;
  header: BackupHeader;
  footer: BackupFooter;
  /** Path of the already-integrity-checked backup file. */
  backupPath: string;
  /** TRUNCATE the target tables first (requires prior consent + backup). */
  clear: boolean;
  verifyMode: "full" | "counts";
  log: TransferLog;
}

export interface LoadOutcome {
  cleared: boolean;
  inserted: number;
  deferredUpdates: number;
  perTable: Record<string, number>;
  verify: VerifyOutcome;
  summary: TransferSummary;
}

/**
 * Per-table mapping between the FILE's row array (header column order) and
 * the TARGET's column list — plus which columns must be deferred.
 */
interface Projection {
  /** Columns that exist on the target, in header order. */
  columns: string[];
  /** File-array index for each entry of `columns`. */
  indices: number[];
  /** Cyclic FK columns written NULL in pass 1. */
  deferred: Set<string>;
  /** Pass-1 INSERT columns (target-present minus deferred). */
  insertColumns: string[];
  /** File-array indices matching `insertColumns`. */
  insertIndices: number[];
}

function buildProjections(
  header: BackupHeader,
  targetSchemas: BackupTableSchema[],
): Map<string, Projection> {
  const targetByName = new Map(targetSchemas.map((t) => [t.name, t]));
  const cyclic = new Map(header.cyclicFks.map((c) => [c.table, new Set(c.columns)]));
  const projections = new Map<string, Projection>();

  for (const table of restorableTables(header)) {
    const target = targetByName.get(table.name);
    const targetCols = new Set(target?.columns.map((c) => c.name) ?? []);
    const deferred = cyclic.get(table.name) ?? new Set<string>();

    const columns: string[] = [];
    const indices: number[] = [];
    table.columns.forEach((column, index) => {
      if (!targetCols.has(column.name)) return;
      columns.push(column.name);
      indices.push(index);
    });

    const insertColumns: string[] = [];
    const insertIndices: number[] = [];
    columns.forEach((name, i) => {
      if (deferred.has(name)) return;
      insertColumns.push(name);
      insertIndices.push(indices[i]);
    });

    projections.set(table.name, { columns, indices, deferred, insertColumns, insertIndices });
  }
  return projections;
}

function insertStatement(table: string, columns: string[], rowCount: number): string {
  const tuples: string[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const start = r * columns.length;
    tuples.push(`(${columns.map((_, i) => `$${start + i + 1}`).join(", ")})`);
  }
  return `INSERT INTO ${quoteIdent(table)} (${quoteIdents(columns)}) VALUES ${tuples.join(", ")}`;
}

function bindLimit(columnCount: number): number {
  const { rowsPerBatch, maxBindParams } = DB_TRANSFER_CONFIG.insert;
  const byParams = Math.floor(maxBindParams / Math.max(columnCount, 1));
  return Math.max(1, Math.min(rowsPerBatch, byParams));
}

/** Plan for pass 2 — resolves file column indices for each deferred column. */
interface DeferredPlan {
  table: string;
  pkColumn: string;
  pkIndex: number;
  columns: string[];
  columnIndices: number[];
}

function buildDeferredPlan(header: BackupHeader, projections: Map<string, Projection>): DeferredPlan[] {
  const plan: DeferredPlan[] = [];
  for (const spec of header.cyclicFks) {
    const table = header.tables.find((t) => t.name === spec.table);
    const projection = projections.get(spec.table);
    if (!table || !projection || projection.columns.length === 0) continue;

    const pkColumn = table.primaryKey[0];
    if (!pkColumn) {
      throw new TransferSafetyError(
        `Table "${spec.table}" participates in a foreign-key cycle (${spec.columns.join(", ")}) ` +
          "but has no primary key, so deferred values cannot be re-linked to individual rows.",
        "Add a primary key to the table, or break the cycle in the schema.",
      );
    }

    const pkIndex = table.columns.findIndex((c) => c.name === pkColumn);
    const columns: string[] = [];
    const columnIndices: number[] = [];
    for (const name of spec.columns) {
      if (!projection.columns.includes(name)) continue;
      const index = table.columns.findIndex((c) => c.name === name);
      if (index < 0) continue;
      columns.push(name);
      columnIndices.push(index);
    }
    if (columns.length > 0 && pkIndex >= 0 && projection.columns.includes(pkColumn)) {
      plan.push({ table: spec.table, pkColumn, pkIndex, columns, columnIndices });
    }
  }
  return plan;
}

/**
 * Restore a verified backup file into the target inside ONE transaction.
 * Throws after rolling back; never returns a partially-applied result.
 */
export async function loadBackupIntoTarget(params: LoadParams): Promise<LoadOutcome> {
  const { client, header, footer, backupPath, clear, verifyMode, log } = params;
  const startedAt = Date.now();

  const targetSchemas = await introspectTables(client);
  const projections = buildProjections(header, targetSchemas);
  const deferredPlan = buildDeferredPlan(header, projections);
  const tables = restorableTables(header);

  const perTable: Record<string, number> = {};
  let inserted = 0;
  let deferredUpdates = 0;
  let lastLogged = 0;

  await client.query("BEGIN");
  try {
    // Only affects genuinely-deferrable constraints; harmless otherwise.
    await client.query("SET CONSTRAINTS ALL DEFERRED").catch(() => undefined);

    if (clear) {
      const names = tables.filter((t) => (projections.get(t.name)?.columns.length ?? 0) > 0);
      if (names.length > 0) {
        await client.query(
          `TRUNCATE TABLE ${names.map((t) => quoteIdent(t.name)).join(", ")} RESTART IDENTITY`,
        );
      }
      log.info(DB_TRANSFER_CONFIG.copy.cleared(names.length));
    } else {
      log.info(DB_TRANSFER_CONFIG.copy.skippedClear);
    }

    /* ---- pass 1: rows (cyclic FK columns written NULL) -------------- */
    log.info("Loading rows …");
    await forEachRowsLine(
      backupPath,
      async (table, rows) => {
        const projection = projections.get(table);
        if (!projection || projection.insertColumns.length === 0) return;

        const limit = bindLimit(projection.insertColumns.length);
        const sql = insertStatement(table, projection.insertColumns, limit);
        let batch: unknown[][] = [];

        const flush = async (size: number): Promise<void> => {
          if (size === 0) return;
          const statement =
            size === limit ? sql : insertStatement(table, projection.insertColumns, size);
          await client.query(statement, batch.flat());
          inserted += size;
          perTable[table] = (perTable[table] ?? 0) + size;
          batch = [];
          if (inserted - lastLogged >= 500) {
            lastLogged = inserted;
            log.info(`  ${inserted} rows inserted …`);
          }
        };

        for (const row of rows) {
          batch.push(projection.insertIndices.map((index) => rowToParams([row[index]])[0]));
          if (batch.length >= limit) await flush(batch.length);
        }
        if (batch.length > 0) await flush(batch.length);
      },
      { skipIntegrityCheck: true },
    );

    /* ---- pass 2: restore deferred FK values ------------------------- */
    if (deferredPlan.length > 0) {
      log.info("Restoring cyclic foreign keys …");
      const byTable = new Map(deferredPlan.map((p) => [p.table, p]));
      await forEachRowsLine(
        backupPath,
        async (table, rows) => {
          const plan = byTable.get(table);
          if (!plan) return;
          for (const row of rows) {
            const live: number[] = [];
            plan.columnIndices.forEach((index, i) => {
              if (row[index] !== null && row[index] !== undefined) live.push(i);
            });
            if (live.length === 0) continue;

            // Placeholders must be contiguous: $1..$k for the set columns,
            // then $(k+1) for the primary key used to locate the row.
            const assignments = live.map(
              (i, position) => `${quoteIdent(plan.columns[i])} = $${position + 1}`,
            );
            const pkSlot = live.length + 1;
            const sql =
              `UPDATE ${quoteIdent(plan.table)} SET ${assignments.join(", ")} ` +
              `WHERE ${quoteIdent(plan.pkColumn)} = $${pkSlot}`;
            const values = [
              ...live.map((i) => rowToParams([row[plan.columnIndices[i]]])[0]),
              rowToParams([row[plan.pkIndex]])[0],
            ];

            await client.query(sql, values);
            deferredUpdates += 1;
          }
        },
        { skipIntegrityCheck: true },
      );
    }

    /* ---- sequence resync -------------------------------------------- */
    if (DB_TRANSFER_CONFIG.syncSequences) {
      await resyncSequences(client, header, targetSchemas, log);
    }

    /* ---- verify BEFORE commit --------------------------------------- */
    log.info("Verifying the target against the backup …");
    const verify = await verifyTargetAgainstBackup(client, header, footer, { mode: verifyMode, log });

    if (!verify.ok) {
      throw new Error(`Verification failed before commit:\n  - ${verify.problems.join("\n  - ")}`);
    }

    await client.query("COMMIT");
    log.ok(`Load committed (${inserted} rows, ${deferredUpdates} deferred FK updates).`);

    return {
      cleared: clear,
      inserted,
      deferredUpdates,
      perTable,
      verify,
      summary: { ...verify.summary, rows: inserted, ms: Date.now() - startedAt },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    log.error(DB_TRANSFER_CONFIG.copy.rollback);
    throw error;
  }
}

/** Point every serial sequence past the highest loaded id. */
async function resyncSequences(
  client: PoolClient,
  header: BackupHeader,
  targetSchemas: BackupTableSchema[],
  log: TransferLog,
): Promise<void> {
  const targetByName = new Map(targetSchemas.map((t) => [t.name, t]));
  let resynced = 0;

  for (const table of restorableTables(header)) {
    const target = targetByName.get(table.name);
    if (!target) continue;
    const targetCols = new Set(target.columns.map((c) => c.name));

    for (const column of table.columns) {
      if (!column.hasSerialDefault || !targetCols.has(column.name)) continue;

      const seqRow = await client.query<{ s: string | null }>(
        "SELECT pg_get_serial_sequence($1, $2) AS s",
        [table.name, column.name],
      );
      const sequence = seqRow.rows[0]?.s;
      if (!sequence) continue;

      const minRow = await client.query<{ min_value: string | number | null }>(
        `SELECT min_value
           FROM pg_catalog.pg_sequences s
          WHERE to_regclass(quote_ident(s.schemaname) || '.' || quote_ident(s.sequencename)) = $1::regclass`,
        [sequence],
      );
      const minValue = Number(minRow.rows[0]?.min_value ?? 1);

      await client.query(
        `SELECT setval($1::regclass,
                       GREATEST(COALESCE((SELECT MAX(${quoteIdent(column.name)})::bigint
                                            FROM ${quoteIdent(table.name)}), $2), $2),
                       (SELECT MAX(${quoteIdent(column.name)})::bigint
                          FROM ${quoteIdent(table.name)}) IS NOT NULL)`,
        [sequence, minValue],
      );
      resynced += 1;
    }
  }

  if (resynced > 0) log.info(`Resynchronised ${resynced} sequence(s).`);
}

/* ------------------------------------------------------------------ *
 * "Already loaded?" short-circuit
 * ------------------------------------------------------------------ */

/**
 * Full comparison of the live target against a backup's footer.
 *
 * This is what makes a crash BETWEEN `COMMIT` and the journal write
 * harmless: the next run discovers the target already matches, records the
 * missed stages and continues — instead of demanding `--replace` to reload
 * data that is already there.
 */
export async function targetAlreadyMatches(
  client: Queryable,
  header: BackupHeader,
  footer: BackupFooter,
  options: { mode?: "full" | "counts"; log?: TransferLog } = {},
): Promise<VerifyOutcome> {
  return verifyTargetAgainstBackup(client, header, footer, options);
}
