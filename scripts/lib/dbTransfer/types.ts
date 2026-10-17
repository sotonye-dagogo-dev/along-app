/**
 * Wire types for the on-disk backup format.
 *
 * Format: newline-delimited JSON (`*.jsonl`), three kinds of line:
 *
 *   {"kind":"header", ...schema + load order...}
 *   {"kind":"rows","table":"User","seq":0,"values":[[...],[...]]}   ← many
 *   {"kind":"footer","rowCounts":{...},"contentHashes":{...},"sha256":"..."}
 *
 * `footer.sha256` covers every preceding line INCLUDING its trailing `\n`,
 * so truncation, reordering and bit-rot are all detectable. `contentHashes`
 * are order-independent (rows are canonically sorted before hashing) so a
 * restored database can be compared against the file regardless of how the
 * table physically stores the rows.
 *
 * Values are tagged (see `codec.ts`) so `timestamp`/`date` travel as raw
 * server text — never as a JS `Date` — which is what keeps the transfer
 * free of timezone corruption.
 */

import type { DbRole } from "../../../app/lib/config/dbTransfer";

/** A single encoded cell as it appears in the file. */
export type EncodedValue = unknown;

export interface BackupColumnMeta {
  name: string;
  /** `information_schema.columns.data_type` — drives param handling. */
  dataType: string;
  /** `information_schema.columns.udt_name` — enum/array element names. */
  udtName: string;
  isNullable: boolean;
  ordinalPosition: number;
  /** Postgres type OID (from `pg_attribute`) — drives read-side parsing. */
  oid: number;
  /** Column default is `nextval(...)` ⇒ a sequence must be resynced. */
  hasSerialDefault: boolean;
  /** Column has ANY default — a target-only column can be filled by it. */
  hasDefault: boolean;
}

export interface BackupForeignKey {
  column: string;
  refTable: string;
  refColumn: string;
  /** Nullability of the SOURCE column — a cycle needs it to be nullable. */
  isNullable: boolean;
}

export interface BackupTableSchema {
  name: string;
  columns: BackupColumnMeta[];
  /** Primary-key columns in ordinal order; empty when the table has none. */
  primaryKey: string[];
  foreignKeys: BackupForeignKey[];
}

export interface BackupSourceInfo {
  role: DbRole | "unknown";
  label: string;
  /** Redacted — safe to print and to store on disk. */
  connection: string;
  /** `scheme://host:port/database` — proves which DB the file came from. */
  fingerprint: string;
}

export interface BackupHeader {
  kind: "header";
  format: string;
  formatVersion: number;
  createdAt: string;
  source: BackupSourceInfo;
  /** Tables in the exact order their rows appear in the file. */
  loadOrder: string[];
  tables: BackupTableSchema[];
  /**
   * FK columns that point at a row in the SAME strongly-connected
   * component (self-relations such as `Post.quotedPostId`, `User.invitedById`).
   * These are written NULL during load and restored by a second UPDATE pass,
   * which is what makes cyclic references loadable in a single transaction.
   */
  cyclicFks: Array<{ table: string; columns: string[] }>;
}

export interface BackupRowsLine {
  kind: "rows";
  table: string;
  seq: number;
  values: EncodedValue[][];
}

export interface BackupFooter {
  kind: "footer";
  totalRows: number;
  rowCounts: Record<string, number>;
  /**
   * `null` when a table exceeded `verify.maxRowsForContentHash` — that
   * table then degrades to count-only verification (with a warning).
   */
  contentHashes: Record<string, string | null>;
  /** sha256 over every preceding line, each terminated by `\n`. */
  sha256: string;
}

export type BackupLine = BackupHeader | BackupRowsLine | BackupFooter;

/** Result of reading + integrity-checking a backup file. */
export interface VerifiedBackup {
  path: string;
  header: BackupHeader;
  footer: BackupFooter;
  bytes: number;
  /** Wall-clock milliseconds the integrity read took. */
  readMs: number;
}

/** Per-table outcome of a load/verify pass. */
export interface TableTransferResult {
  table: string;
  rows: number;
  expected: number;
  contentHash: string | null;
  expectedHash: string | null;
  hashMatched: boolean | null;
}

export interface TransferSummary {
  tables: number;
  rows: number;
  ms: number;
  results: TableTransferResult[];
}

/** Thrown whenever a backup file cannot be trusted. */
export class CorruptBackupError extends Error {
  readonly code = "CORRUPT_BACKUP";
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = "CorruptBackupError";
    this.path = path;
  }
}

/** Thrown when a run must stop to avoid destroying data. */
export class TransferSafetyError extends Error {
  readonly code = "TRANSFER_SAFETY";
  readonly remedy: string;

  constructor(message: string, remedy: string) {
    super(message);
    this.name = "TransferSafetyError";
    this.remedy = remedy;
  }
}
