/**
 * Backup reader + integrity verification.
 *
 * A file is only trusted if ALL of this holds:
 *   1. it parses line-by-line as the expected format/version,
 *   2. a `header` is the first line and a `footer` is the last,
 *   3. `footer.sha256` matches a hash recomputed over every earlier line —
 *      this catches truncation, bit-rot, partial copies and edits,
 *   4. the per-table row counts accumulated while streaming equal the
 *      counts declared in the footer,
 *   5. rows for a table appear in exactly one contiguous block, in the
 *      order the header promised.
 *
 * Nothing is loaded into memory except the header, the footer and a small
 * per-table counter — so verifying a large file costs one streaming pass.
 */

import { createReadStream, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { DB_TRANSFER_CONFIG } from "../../../app/lib/config/dbTransfer";
import { createLineHasher } from "./checksum";
import type { BackupFooter, BackupHeader, BackupRowsLine, VerifiedBackup } from "./types";
import { CorruptBackupError } from "./types";

function corrupt(message: string, path: string): never {
  throw new CorruptBackupError(message, path);
}

export interface ReadBackupOptions {
  /** Print per-table progress while scanning. */
  onTable?: (table: string, rows: number, expected: number | null) => void;
}

/**
 * Stream the file, verify it end-to-end, and hand back header + footer.
 * Throws `CorruptBackupError` — never returns a partially-trusted result.
 */
export async function verifyBackupFile(
  path: string,
  options: ReadBackupOptions = {},
): Promise<VerifiedBackup> {
  const startedAt = Date.now();
  const bytes = statSync(path).size;
  const hasher = createLineHasher();

  let header: BackupHeader | null = null;
  let footer: BackupFooter | null = null;
  let currentTable: string | null = null;
  let currentSeq = 0;
  const counts: Record<string, number> = {};

  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (line.length === 0) continue;

      if (footer) {
        corrupt(`extra content after the footer line at ${path}`, path);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        corrupt(
          `line is not valid JSON (${(error as Error).message}) — the file is damaged`,
          path,
        );
      }

      const record = parsed as Record<string, unknown>;

      if (record.kind === "footer") {
        footer = record as unknown as BackupFooter;
        const expected = footer.sha256;
        const actual = hasher.digest();
        if (!expected || typeof expected !== "string") {
          corrupt("footer is missing its sha256", path);
        }
        if (actual !== expected) {
          corrupt(
            `sha256 mismatch (expected ${expected.slice(0, 16)}…, got ${actual.slice(0, 16)}…) — ` +
              "content differs from what was written",
            path,
          );
        }
        continue;
      }

      hasher.update(line);

      if (!header) {
        if (record.kind !== "header") {
          corrupt("first line is not a header", path);
        }
        header = record as unknown as BackupHeader;
        if (header.format !== DB_TRANSFER_CONFIG.format) {
          corrupt(`unknown format "${String(header.format)}"`, path);
        }
        if (typeof header.formatVersion !== "number") {
          corrupt("header has no formatVersion", path);
        }
        if (header.formatVersion > DB_TRANSFER_CONFIG.formatVersion) {
          corrupt(
            `file was written by a newer tool (format v${header.formatVersion}, this tool supports v${DB_TRANSFER_CONFIG.formatVersion})`,
            path,
          );
        }
        continue;
      }

      if (record.kind !== "rows") {
        corrupt(`unexpected line kind "${String(record.kind)}"`, path);
      }
      const rowsLine = record as unknown as BackupRowsLine;
      const table = rowsLine.table;

      if (!header.loadOrder.includes(table)) {
        corrupt(`rows for unknown table "${table}"`, path);
      }
      if (currentTable !== table) {
        if (currentTable !== null && counts[table] !== undefined) {
          corrupt(
            `rows for table "${table}" are split across the file (not contiguous)`,
            path,
          );
        }
        currentTable = table;
        currentSeq = 0;
      }
      if (rowsLine.seq !== currentSeq) {
        corrupt(
          `out-of-sequence chunk for "${table}" (expected ${currentSeq}, got ${String(rowsLine.seq)})`,
          path,
        );
      }
      if (!Array.isArray(rowsLine.values)) {
        corrupt(`chunk for "${table}" has no values array`, path);
      }
      currentSeq += 1;
      counts[table] = (counts[table] ?? 0) + rowsLine.values.length;
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  if (!header) corrupt("file contains no header", path);
  if (!footer) corrupt("file is truncated — no footer line (backup never finished)", path);

  for (const table of header.loadOrder) {
    const expected = footer.rowCounts[table] ?? 0;
    const actual = counts[table] ?? 0;
    if (expected !== actual) {
      corrupt(
        `row count mismatch on "${table}" (footer says ${expected}, file holds ${actual})`,
        path,
      );
    }
    options.onTable?.(table, actual, expected);
  }

  const extra = Object.keys(footer.rowCounts).filter((t) => !header.loadOrder.includes(t));
  if (extra.length > 0) {
    corrupt(`footer declares tables absent from the header: ${extra.join(", ")}`, path);
  }

  return {
    path,
    header,
    footer,
    bytes,
    readMs: Date.now() - startedAt,
  };
}

/**
 * Stream verified row chunks in file order. The file is integrity-checked
 * first (header + footer pass), then rows are handed to `onRows` as they
 * are read — so a restore never writes a row that failed verification.
 */
export async function forEachRowsLine(
  path: string,
  onRows: (table: string, rows: BackupRowsLine["values"]) => Promise<void> | void,
  options: { skipIntegrityCheck?: boolean } = {},
): Promise<void> {
  if (!options.skipIntegrityCheck) {
    // Full pass first: guarantees the file is trustworthy before any write.
    await verifyBackupFile(path);
  }

  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (line.length === 0) continue;
      const record = JSON.parse(line) as { kind: string; table?: string; values?: BackupRowsLine["values"] };
      if (record.kind !== "rows") continue;
      if (!record.table || !record.values) continue;
      await onRows(record.table, record.values);
    }
  } finally {
    rl.close();
    stream.destroy();
  }
}
