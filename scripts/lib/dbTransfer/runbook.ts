/**
 * The runbook â€” one implementation of the stage machine every transfer
 * command walks, so `db:migrate-supabase`, `db:backup-local`,
 * `db:restore-local` and `db:backup-supabase` cannot drift apart.
 *
 * â”€â”€ Stage machine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *   backup-created â†’ target-inspected â†’ target-safety-backup â†’ schema-ready
 *                  â†’ loaded â†’ verified â†’ consumed
 *
 * Each completed stage is journaled IMMEDIATELY. That is what makes the
 * tool resumable:
 *
 *   â€¢ crash after the dump      â†’ next run reuses the file (no re-dump)
 *   â€¢ crash after the commit    â†’ next run sees the target already matches
 *                                 and records the missed stages instead of
 *                                 demanding `--replace` for data already there
 *   â€¢ crash mid-transaction     â†’ Postgres rolled it back; the run simply
 *                                 repeats the load
 *   â€¢ crash after `consumed`    â†’ never reused; a fresh backup is taken
 *
 * â”€â”€ Destructive safety â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * A non-empty target is only ever cleared when ALL of these hold:
 *   1. the operator passed `--replace` (or confirmed interactively),
 *   2. a full local safety backup of that target VERIFIED successfully,
 *   3. the clear happens inside the load transaction, after which the
 *      target is re-read and compared against the backup before COMMIT.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  DB_TRANSFER_CONFIG,
  backupFileName,
  describeConnection,
  type DbEndpoint,
  type DbRole,
  type DbStagePlan,
  type DbTransferJournalEntry,
} from "../../../app/lib/config/dbTransfer";
import {
  confirmDestructiveAction,
  envInt,
  flagBool,
  hasReplaceConsent,
  resolveVerifyMode,
  safetyBackupEnabled,
  type ParsedArgs,
} from "./cli";
import { createTransferPool, pingDatabase, withClient } from "./connection";
import { dumpDatabase, type DumpResult } from "./dump";
import type { TransferLog } from "./log";
import { inspectTarget, introspectTables, listTables } from "./introspect";
import { verifyBackupFile } from "./read";
import {
  diffSchema,
  describeSchemaDiff,
  ensureSchema,
  loadBackupIntoTarget,
  targetAlreadyMatches,
} from "./restore";
import {
  backupDirectory,
  ensureEntry,
  findEntry,
  findResumableEntry,
  latestBackupFile,
  recordStage,
} from "./state";
import type { BackupFooter, BackupHeader, VerifiedBackup } from "./types";
import { CorruptBackupError, TransferSafetyError } from "./types";
import { detectDevAliasConflict, resolveUsableUrl } from "./url";

export interface RunbookParams {
  title: string;
  /** `null` means "the source is a file, not a database" (`db:restore-local`). */
  sourceRole: DbRole | null;
  /** `null` means "dump only, land on disk" (`db:backup-local`). */
  targetRole: DbRole | null;
  plan: DbStagePlan;
  args: ParsedArgs;
  env: Record<string, string | undefined>;
  log: TransferLog;
  /** Stop after preflight + schema diff; touch nothing. */
  dryRun?: boolean;
  /** Only verify an existing backup's integrity, then exit. */
  checkOnly?: boolean;
  /** `db:restore-local --latest` supplied the file instead of dumping. */
  fixedFile?: string;
}

export interface RunbookResult {
  file: string;
  entryId: string;
  loaded: boolean;
  skipped: "already-matches" | "check-only" | "dry-run" | null;
  rows: number;
  tables: number;
  ms: number;
}

interface ParsedConnection {
  url: string;
  role: DbRole;
  fromVar: string | null;
  notes: string[];
}

/** Human label for a role, from the registry. */
function roleLabel(endpoint: DbEndpoint | null): string {
  if (!endpoint) return "local backup file";
  const role = DB_TRANSFER_CONFIG.roles[endpoint as DbRole];
  return role ? role.label : String(endpoint);
}

function describeRole(endpoint: DbEndpoint | null): string {
  return roleLabel(endpoint);
}

/** Resolve a role into a connection ready for the preflight report. */
function connectionFor(
  role: DbRole | null,
  urlOverride: string | undefined,
  env: Record<string, string | undefined>,
): ParsedConnection | null {
  if (!role) return null;
  const resolved = resolveUsableUrl(role, { url: urlOverride, env });
  return { url: resolved.url, role, fromVar: resolved.fromVar, notes: resolved.notes };
}

/** â”€â”€ preflight â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function preflight(
  params: RunbookParams,
  connections: Array<ParsedConnection | null>,
): void {
  params.log.step("Preflight â€” resolve and validate connections");
  for (const connection of connections) {
    if (!connection) continue;
    params.log.info(
      `${roleLabel(connection.role)}: ${describeConnection(connection.url)}` +
        (connection.fromVar ? `  (from ${connection.fromVar})` : "  (from CLI override)"),
    );
    for (const note of connection.notes) params.log.info(`  Â· ${note}`);
  }

  if (params.targetRole) {
    const target = connections.find((c) => c?.role === params.targetRole);
    if (target) {
      for (const warning of detectDevAliasConflict(target.url, params.env)) {
        params.log.warn(warning);
      }
    }
  }
  params.log.done("preflight");
}

/** â”€â”€ dump / reuse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

async function dumpOrReuse(
  params: RunbookParams,
  role: DbRole,
  source: ParsedConnection,
  existing: { header: BackupHeader; footer: BackupFooter; file: string } | null,
  existingEntryId: string,
): Promise<{ header: BackupHeader; footer: BackupFooter; file: string; entryId: string }> {
  if (existing) {
    // The caller has already printed the resume banner and verified the
    // file; all that is left is to keep pointing at the same journal entry.
    return { ...existing, entryId: existingEntryId };
  }

  params.log.step(`Dump ${describeRole(role)} â†’ local file`);
  const fileName = backupFileName({
    source: role,
    target: params.targetRole ?? "local",
  });
  const file = join(backupDirectory(params.env), fileName);
  mkdirSync(backupDirectory(params.env), { recursive: true });

  const entry = ensureEntry({
    direction: { source: role, target: params.targetRole ?? "local" },
    file: join(DB_TRANSFER_CONFIG.directory, fileName),
    env: params.env,
  });

  const pool = createTransferPool(source.url, { max: 2, applicationName: "along-db-dump" });
  try {
    const result: DumpResult = await dumpDatabase({
      client: pool,
      role,
      label: roleLabel(role),
      connectionUrl: source.url,
      outFile: file,
      log: params.log,
    });
    recordStage(
      entry.id,
      "backup-created",
      {
        note: `${result.footer.totalRows} rows / ${result.header.tables.length} tables`,
        meta: { sha256: result.footer.sha256, bytes: result.bytes, path: result.path },
      },
      params.env,
    );
    params.log.done("dump", result.ms);
    return { header: result.header, footer: result.footer, file: result.path, entryId: entry.id };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

/** â”€â”€ target safety backup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

async function takeSafetyBackup(
  params: RunbookParams,
  target: ParsedConnection,
  entryId: string,
): Promise<void> {
  params.log.step("Safety backup of the target before any destructive step");
  const fileName = backupFileName({ source: params.targetRole ?? "supabase", target: "local" });
  const file = join(backupDirectory(params.env), fileName);

  const pool = createTransferPool(target.url, { max: 2, applicationName: "along-db-safety" });
  try {
    const present = await listTables(pool);
    if (present.length === 0) {
      params.log.info("Target has no tables â€” nothing to preserve.");
      return;
    }
    const result = await dumpDatabase({
      client: pool,
      role: params.targetRole ?? "supabase",
      label: `${roleLabel(params.targetRole)} (pre-overwrite safety copy)`,
      connectionUrl: target.url,
      outFile: file,
      log: params.log,
      onlyTables: present,
    });
    // Prove the safety copy is readable BEFORE anything is destroyed.
    await verifyBackupFile(result.path);
    recordStage(
      entryId,
      "target-safety-backup",
      { note: DB_TRANSFER_CONFIG.copy.safetyOk(result.path), meta: { path: result.path } },
      params.env,
    );
    params.log.ok(DB_TRANSFER_CONFIG.copy.safetyOk(result.path));
    params.log.done("safety backup", result.ms);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

/** â”€â”€ the whole run â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function runTransfer(params: RunbookParams): Promise<RunbookResult> {
  const startedAt = Date.now();
  const { log, env, plan } = params;
  const direction = {
    source: (params.sourceRole ?? "local") as DbEndpoint,
    target: (params.targetRole ?? "local") as DbEndpoint,
  };

  log.banner(params.title);
  log.begin(plan.length + 3);

  if (params.args.flags.help === true) return { file: "", entryId: "", loaded: false, skipped: null, rows: 0, tables: 0, ms: 0 };

  const source = connectionFor(
    params.sourceRole,
    params.args.flags["source-url"] as string | undefined,
    env,
  );
  const target = connectionFor(
    params.targetRole,
    params.args.flags["target-url"] as string | undefined,
    env,
  );

  preflight(params, [source, target]);

  const liveness = await Promise.all(
    [
      source ? pingDatabase(source.url, describeRole(params.sourceRole)) : null,
      target ? pingDatabase(target.url, describeRole(params.targetRole as DbRole)) : null,
    ].filter(Boolean) as Array<Promise<{ ok: boolean; detail: string }>>,
  );
  for (const probe of liveness) {
    if (probe.ok) log.info(probe.detail);
    else log.error(probe.detail);
  }
  const failed = liveness.find((p) => !p.ok);
  if (failed) {
    throw new TransferSafetyError(
      failed.detail,
      "Check the connection string, credentials and network access, then re-run.",
    );
  }

  const verifyMode = resolveVerifyMode(env, params.args.flags["verify-mode"] as string | undefined);
  log.info(`Verify mode: ${verifyMode} Â· backup dir: ${backupDirectory(env)}`);

  if (params.checkOnly) {
    log.step("Checking an existing backup file");
    const file =
      params.fixedFile ??
      findEntry(direction, env)?.file ??
      latestBackupFile(direction, env)?.path;
    if (!file) {
      throw new TransferSafetyError("No backup file to check.", "Run the command without --check first.");
    }
    const verified = await verifyBackupFile(file, {
      onTable: (table, rows) => log.table(table, rows),
    });
    log.ok(DB_TRANSFER_CONFIG.copy.integrityOk(verified.footer.totalRows, verified.header.tables.length));
    return {
      file: verified.path,
      entryId: "",
      loaded: false,
      skipped: "check-only",
      rows: verified.footer.totalRows,
      tables: verified.header.tables.length,
      ms: Date.now() - startedAt,
    };
  }

  /* â”€â”€ stage 1: obtain the backup file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  let reuse: VerifiedBackup | null = null;
  let entryId = "";

  if (params.fixedFile) {
    params.log.step("Using the backup file supplied via --file");
    const verified = await verifyBackupFile(params.fixedFile, {
      onTable: (table, rows) => log.table(table, rows),
    });
    log.ok(DB_TRANSFER_CONFIG.copy.integrityOk(verified.footer.totalRows, verified.header.tables.length));
    reuse = verified;
  } else {
    const lookup = findResumableEntry({
      direction,
      plan,
      env,
      allowResume: !flagBool(params.args, "fresh"),
    });
    if (lookup.decision.resumable && lookup.entry) {
      try {
        const verified = await verifyBackupFile(lookup.entry.file, {
          onTable: (table, rows) => log.table(table, rows),
        });
        reuse = verified;
        entryId = lookup.entry.id;
        log.info(
          DB_TRANSFER_CONFIG.copy.resumeFound(
            lookup.entry.id,
            lookup.decision.stage ?? plan[0],
            lookup.decision.ageMinutes,
          ),
        );
      } catch (error) {
        log.warn(
          `Candidate backup could not be trusted (${(error as Error).message}) â€” taking a fresh one.`,
        );
        if (error instanceof CorruptBackupError) {
          recordStage(lookup.entry.id, "backup-created", { note: "rejected: corrupt file" }, env);
          reuse = null;
        }
      }
    } else {
      log.info(DB_TRANSFER_CONFIG.copy.resumeNone(lookup.decision.reason));
    }
  }

  if (!params.fixedFile && !source) {
    throw new TransferSafetyError(
      "No source connection available.",
      "Set a source URL (PREVIOUS_DIRECT_URL for the legacy database) or pass --source-url.",
    );
  }

  let header: BackupHeader;
  let footer: BackupFooter;
  let file: string;

  if (reuse) {
    // Either an operator-supplied --file, or a recent uncorrupted backup
    // found in the journal. Either way: verified above, so just adopt it.
    header = reuse.header;
    footer = reuse.footer;
    file = reuse.path;
    if (!entryId) entryId = ensureEntry({ direction, file, env }).id;
  } else {
    const dumped = await dumpOrReuse(params, source!.role, source!, null, "");
    header = dumped.header;
    footer = dumped.footer;
    file = dumped.file;
    entryId = dumped.entryId;
  }

  const entryFor = (): DbTransferJournalEntry | null => findEntry(direction, env);

  if (params.dryRun) {
    log.step("Dry run â€” stopping before any write to the target");
    if (target) {
      const pool = createTransferPool(target.url, { max: 1 });
      try {
        const names = await listTables(pool);
        const schemas = await introspectTables(pool);
        for (const line of describeSchemaDiff(diffSchema(header, schemas, names))) log.info(line);
      } finally {
        await pool.end().catch(() => undefined);
      }
    }
    log.ok("Dry run complete â€” nothing was modified.");
    return {
      file,
      entryId,
      loaded: false,
      skipped: "dry-run",
      rows: footer.totalRows,
      tables: header.tables.length,
      ms: Date.now() - startedAt,
    };
  }

  /* â”€â”€ stage 2: load (only when a target exists) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  if (!target || !params.targetRole) {
    recordStage(entryId, "consumed", { note: "local-only backup" }, env);
    log.ok(DB_TRANSFER_CONFIG.copy.summary(footer.totalRows, header.tables.length, Date.now() - startedAt));
    return {
      file,
      entryId,
      loaded: false,
      skipped: null,
      rows: footer.totalRows,
      tables: header.tables.length,
      ms: Date.now() - startedAt,
    };
  }

  log.step(`Inspect ${describeRole(params.targetRole)}`);
  const targetPool = createTransferPool(target.url, { max: 2, applicationName: "along-db-load" });
  try {
    const entry = entryFor();
    const expected = header.tables.map((t) => t.name);
    const live = await inspectTarget(targetPool, expected);

    const recordedBefore = entry?.stages["target-inspected"]?.meta as
      | { totalRows?: number }
      | undefined;
    const preStateRows = recordedBefore?.totalRows ?? live.totalRows;

    log.info(
      `Target holds ${live.totalRows} row(s) across ${live.nonEmptyTables} table(s); ` +
        `backup holds ${footer.totalRows}.`,
    );
    recordStage(
      entryId,
      "target-inspected",
      { note: `${live.totalRows} rows before load`, meta: { totalRows: live.totalRows, counts: live.counts } },
      env,
    );
    log.done("target inspection");

    /* Already in sync? (crash-after-commit / repeat-run short-circuit) */
    if (live.totalRows > 0) {
      const match = await targetAlreadyMatches(targetPool, header, footer, { mode: verifyMode, log });
      if (match.ok) {
        recordStage(entryId, "loaded", { note: "target already matched the backup" }, env);
        recordStage(entryId, "verified", { note: "target already matched the backup" }, env);
        recordStage(entryId, "consumed", { note: "no load needed" }, env);
        log.clearProgress();
        log.ok("Target already contains exactly this backup â€” nothing to load.");
        return {
          file,
          entryId,
          loaded: false,
          skipped: "already-matches",
          rows: footer.totalRows,
          tables: header.tables.length,
          ms: Date.now() - startedAt,
        };
      }
      if (match.problems.length > 0 && match.problems.length <= 5) {
        for (const problem of match.problems) log.info(`  Â· ${problem}`);
      } else if (match.problems.length > 5) {
        log.info(`  Â· ${match.problems.length} difference(s) from the backup`);
      }
    }

    const needsClear = live.totalRows > 0 || preStateRows > 0;

    if (needsClear) {
      const consent = hasReplaceConsent(params.args);
      const proceed = await confirmDestructiveAction({
        summary:
          `${describeRole(params.targetRole)} holds ${live.totalRows} row(s) that this run ` +
          `would replace with ${footer.totalRows} row(s) from ${describeRole(params.sourceRole)}.`,
        consentGiven: consent,
      });
      if (!proceed) {
        throw new TransferSafetyError(
          "Overwrite declined â€” no changes were made.",
          "Re-run with --replace to overwrite, or restore into a different target.",
        );
      }
      if (safetyBackupEnabled(env)) {
        const alreadyBackedUp = Boolean(entryFor()?.stages["target-safety-backup"]);
        if (alreadyBackedUp) {
          log.info("Target safety backup already recorded in this run â€” not re-taking it.");
        } else if (live.totalRows > 0) {
          await takeSafetyBackup(params, target, entryId);
        }
      } else {
        log.warn(
          `${DB_TRANSFER_CONFIG.safetyBackup.envKey}=false â€” skipping the target safety backup. ` +
            "A failed overwrite would be unrecoverable.",
        );
      }
    } else {
      log.info(DB_TRANSFER_CONFIG.copy.skippedClear);
    }

    /* Schema */
    log.step("Prepare target schema");
    const schema = await ensureSchema({
      pool: targetPool,
      header,
      targetUrl: target.url,
      allowDrop: needsClear,
      log,
    });
    for (const line of describeSchemaDiff(schema.diff)) log.info(line);
    recordStage(
      entryId,
      "schema-ready",
      { note: `state=${schema.diff.state}${schema.created ? " (created)" : ""}` },
      env,
    );
    log.done("schema");

    /* Load â€” one transaction, verified before COMMIT */
    log.step(`Load into ${describeRole(params.targetRole)}`);
    const outcome = await withClient(targetPool, (client) =>
      loadBackupIntoTarget({
        client: client as never,
        header,
        footer,
        backupPath: file,
        clear: needsClear,
        verifyMode,
        log,
      }),
    );
    recordStage(
      entryId,
      "loaded",
      { note: `${outcome.inserted} rows`, meta: { inserted: outcome.inserted, perTable: outcome.perTable } },
      env,
    );
    recordStage(entryId, "verified", { note: `${verifyMode} verification passed` }, env);
    log.done("load + verify", outcome.summary.ms);

    log.step("Consume backup");
    recordStage(entryId, "consumed", { note: "restore completed and verified" }, env);
    log.ok(`Backup ${entryId} marked consumed â€” it will not be reused.`);

    log.clearProgress();
    log.line("");
    log.ok(DB_TRANSFER_CONFIG.copy.summary(outcome.inserted, header.tables.length, Date.now() - startedAt));
    for (const result of outcome.verify.summary.results) {
      log.table(result.table, result.rows === result.expected ? result.rows : `${result.rows}/${result.expected}`);
    }

    return {
      file,
      entryId,
      loaded: true,
      skipped: null,
      rows: outcome.inserted,
      tables: header.tables.length,
      ms: Date.now() - startedAt,
    };
  } finally {
    await targetPool.end().catch(() => undefined);
  }
}

/** Read the freshness window override from the environment. */
export function freshnessMinutes(env: Record<string, string | undefined> = process.env): number {
  return envInt(env, DB_TRANSFER_CONFIG.resume.envKey, DB_TRANSFER_CONFIG.resume.freshnessMinutes, {
    min: 1,
    max: 60 * 24 * 30,
  });
}
