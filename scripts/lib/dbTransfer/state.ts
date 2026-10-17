/**
 * Transfer journal â€” the file that makes an interrupted run resumable.
 *
 * Every operation records its completed stages under a stable id (derived
 * from the dump file name). On the next run the journal answers:
 *
 *   "Is there a COMPLETE-but-UNUSED backup, extremely recent, matching this
 *    direction, whose file still passes integrity verification?"
 *
 * If yes â†’ skip the dump and continue from the first unfinished stage.
 * If no  â†’ start fresh.
 *
 * Writes are atomic (temp file + rename) so a crash mid-write can never
 * leave a half-written journal behind, and every recorded stage carries a
 * timestamp + free-form note so `state.json` doubles as an audit trail.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  DB_TRANSFER_CONFIG,
  backupId,
  evaluateResume,
  type DbEndpoint,
  type DbStage,
  type DbStagePlan,
  type DbStageRecord,
  type DbTransferJournal,
  type DbTransferJournalEntry,
  type ResumeDecision,
} from "../../../app/lib/config/dbTransfer";

const JOURNAL_VERSION = 1;

function journalPath(env: Record<string, string | undefined> = process.env): string {
  return (env.DB_BACKUP_JOURNAL ?? "").trim() || DB_TRANSFER_CONFIG.journalFile;
}

export function backupDirectory(env: Record<string, string | undefined> = process.env): string {
  return (env.DB_BACKUP_DIR ?? "").trim() || DB_TRANSFER_CONFIG.directory;
}

function emptyJournal(): DbTransferJournal {
  return { version: JOURNAL_VERSION, updatedAt: new Date().toISOString(), entries: [] };
}

/** Read the journal; a missing or unreadable file means "no prior runs". */
export function loadJournal(env: Record<string, string | undefined> = process.env): DbTransferJournal {
  const path = journalPath(env);
  if (!existsSync(path)) return emptyJournal();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as DbTransferJournal;
    if (!parsed || !Array.isArray(parsed.entries)) return emptyJournal();
    return { version: parsed.version ?? JOURNAL_VERSION, updatedAt: parsed.updatedAt ?? "", entries: parsed.entries };
  } catch {
    // Never let a damaged journal take the tool down â€” recover to empty
    // (the next run simply starts from scratch, which is always safe).
    return emptyJournal();
  }
}

/** Atomic write: temp file in the same directory, then rename over. */
export function saveJournal(journal: DbTransferJournal, env: Record<string, string | undefined> = process.env): void {
  const path = journalPath(env);
  mkdirSync(dirname(path), { recursive: true });
  const payload = JSON.stringify(
    { ...journal, updatedAt: new Date().toISOString(), entries: pruneEntries(journal.entries) },
    null,
    2,
  );
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, payload, "utf8");
  renameSync(tmp, path);
}

function pruneEntries(entries: DbTransferJournalEntry[]): DbTransferJournalEntry[] {
  const now = Date.now();
  const ttl = DB_TRANSFER_CONFIG.retention.consumedTtlDays * 86_400_000;
  const max = DB_TRANSFER_CONFIG.retention.maxEntries;

  const kept = entries.filter((entry) => {
    if (!entry.stages.consumed) return true;
    const age = now - new Date(entry.stages.consumed.at).getTime();
    return Number.isFinite(age) ? age < ttl : true;
  });

  kept.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  // Never prune something that has not been consumed yet.
  const unconsumed = kept.filter((e) => !e.stages.consumed);
  const consumed = kept.filter((e) => e.stages.consumed);
  return [...unconsumed, ...consumed].slice(0, Math.max(max, unconsumed.length));
}

export function findEntry(
  direction: { source: DbEndpoint; target: DbEndpoint },
  env: Record<string, string | undefined> = process.env,
): DbTransferJournalEntry | null {
  const journal = loadJournal(env);
  const matches = journal.entries.filter(
    (e) => e.direction.source === direction.source && e.direction.target === direction.target,
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return matches[0];
}

export interface ResumeLookup {
  entry: DbTransferJournalEntry | null;
  decision: ResumeDecision;
}

/**
 * Find a resume candidate for a run. `existsSync` is part of the check â€”
 * a journal entry whose file was deleted is not resumable.
 */
export function findResumableEntry(params: {
  direction: { source: DbEndpoint; target: DbEndpoint };
  plan: DbStagePlan;
  env?: Record<string, string | undefined>;
  now?: Date;
  freshnessMinutes?: number;
  /** Set false to force a fresh dump (`--fresh`). */
  allowResume?: boolean;
}): ResumeLookup {
  const env = params.env ?? process.env;
  if (params.allowResume === false) {
    return {
      entry: null,
      decision: {
        resumable: false,
        reason: "resume disabled by --fresh",
        stage: null,
        ageMinutes: 0,
      },
    };
  }

  const entry = findEntry(params.direction, env);
  const decision = evaluateResume({
    entry,
    direction: params.direction,
    plan: params.plan,
    now: params.now,
    freshnessMinutes: params.freshnessMinutes,
  });

  if (decision.resumable && entry) {
    const onDisk = entry.file.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(entry.file)
      ? entry.file
      : join(process.cwd(), entry.file);
    if (!existsSync(onDisk)) {
      return {
        entry,
        decision: { ...decision, resumable: false, reason: "dump file is missing on disk" },
      };
    }
  }

  return { entry: decision.resumable ? entry : null, decision };
}

/** Create (or reuse) the journal entry that owns a dump file. */
export function ensureEntry(params: {
  direction: { source: DbEndpoint; target: DbEndpoint };
  file: string;
  env?: Record<string, string | undefined>;
}): DbTransferJournalEntry {
  const env = params.env ?? process.env;
  const journal = loadJournal(env);
  const id = backupId(params.file.split(/[\\/]/).pop() ?? params.file);
  const existing = journal.entries.find((e) => e.id === id);
  const now = new Date().toISOString();

  if (existing) {
    existing.file = params.file;
    existing.updatedAt = now;
    saveJournal(journal, env);
    return existing;
  }

  const entry: DbTransferJournalEntry = {
    id,
    direction: params.direction,
    file: params.file,
    createdAt: now,
    updatedAt: now,
    stages: {},
  };
  journal.entries.push(entry);
  saveJournal(journal, env);
  return entry;
}

/** Record that a stage finished (idempotent â€” re-recording just refreshes). */
export function recordStage(
  entryId: string,
  stage: DbStage,
  record: Omit<DbStageRecord, "at"> = {},
  env: Record<string, string | undefined> = process.env,
): DbTransferJournalEntry | null {
  const journal = loadJournal(env);
  const entry = journal.entries.find((e) => e.id === entryId);
  if (!entry) return null;
  entry.stages[stage] = { at: new Date().toISOString(), ...record };
  entry.updatedAt = entry.stages[stage]!.at;
  saveJournal(journal, env);
  return entry;
}

/* ------------------------------------------------------------------ *
 * File discovery
 * ------------------------------------------------------------------ */

export interface BackupFileInfo {
  path: string;
  relative: string;
  fileName: string;
  createdAt: Date;
  bytes: number;
}

/** Dump files on disk, newest first (optionally filtered by direction). */
export function listBackupFiles(
  direction?: { source: DbEndpoint; target: DbEndpoint },
  env: Record<string, string | undefined> = process.env,
): BackupFileInfo[] {
  const dir = backupDirectory(env);
  if (!existsSync(dir)) return [];
  const prefix = direction
    ? `${
        DB_TRANSFER_CONFIG.roles[direction.source as "legacy" | "supabase"]?.short ??
        direction.source
      }-to-${
        DB_TRANSFER_CONFIG.roles[direction.target as "legacy" | "supabase"]?.short ??
        direction.target
      }-`
    : "";

  const files: BackupFileInfo[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".jsonl") || name.endsWith(".part")) continue;
    if (prefix && !name.startsWith(prefix)) continue;
    const path = resolve(dir, name);
    try {
      const stats = statSync(path);
      files.push({
        path,
        relative: join(dir, name),
        fileName: name,
        createdAt: stats.mtime,
        bytes: stats.size,
      });
    } catch {
      /* file vanished between readdir and stat */
    }
  }
  files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return files;
}

/** Most recent dump for a direction (`db:restore --latest`). */
export function latestBackupFile(
  direction?: { source: DbEndpoint; target: DbEndpoint },
  env: Record<string, string | undefined> = process.env,
): BackupFileInfo | null {
  return listBackupFiles(direction, env)[0] ?? null;
}

/** Remove stray `.part` files left by a killed writer. */
export function cleanupPartialFiles(env: Record<string, string | undefined> = process.env): string[] {
  const dir = backupDirectory(env);
  if (!existsSync(dir)) return [];
  const removed: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".part")) continue;
    const path = join(dir, name);
    try {
      // Only clear parts older than an hour â€” a concurrent run may own it.
      if (Date.now() - statSync(path).mtimeMs > 3_600_000) {
        unlinkSync(path);
        removed.push(name);
      }
    } catch {
      /* best effort */
    }
  }
  return removed;
}
