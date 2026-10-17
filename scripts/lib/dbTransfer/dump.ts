/**
 * Backup writer — dumps a database to a checksummed JSONL file.
 *
 * Guarantees:
 *  - the file only ever appears under its final name once COMPLETELY written
 *    (`.part` → atomic rename), so a truncated dump can never be mistaken
 *    for a good one;
 *  - `footer.sha256` covers every preceding line, so corruption and
 *    truncation are detectable by re-reading;
 *  - per-table content hashes are order-independent, so a restored database
 *    can be compared against the file no matter how rows are stored;
 *  - rows are emitted in the FK-safe `loadOrder`, so a restore can stream
 *    the file straight through without re-sorting.
 */

import { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync, statSync, type WriteStream } from "node:fs";
import { dirname } from "node:path";
import { types as pgTypes } from "pg";
import {
  DB_TRANSFER_CONFIG,
  describeConnection,
  fingerprintConnection,
  redactConnectionString,
  type DbRole,
} from "../../../app/lib/config/dbTransfer";
import { createLineHasher } from "./checksum";
import { applyPgTypeOverrides, canonicalRowString, contentHash, encodeRow } from "./codec";
import type { TransferLog } from "./log";
import { buildLoadPlan, introspectTables, quoteIdents, type Queryable } from "./introspect";
import { readTableRows, tableRowCount } from "./rows";
import type { BackupFooter, BackupHeader, BackupRowsLine, BackupSourceInfo, BackupTableSchema } from "./types";

export interface DumpOptions {
  client: Queryable;
  role: DbRole;
  label: string;
  /** Already-normalised connection string; only ever redacted on output. */
  connectionUrl: string;
  /** Final destination path (the `.part` sibling is used while writing). */
  outFile: string;
  log: TransferLog;
  /**
   * Restrict the dump to these tables (used when snapshotting a target whose
   * schema is only partially populated). Defaults to every public table.
   */
  onlyTables?: readonly string[];
  /** Rows fetched per pagination query. */
  pageRows?: number;
}

export interface DumpResult {
  path: string;
  partPath: string;
  header: BackupHeader;
  footer: BackupFooter;
  bytes: number;
  ms: number;
}

function writeChunk(stream: WriteStream, chunk: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.write(chunk, "utf8", (err) => (err ? reject(err) : resolve()));
  });
}

export async function dumpDatabase(options: DumpOptions): Promise<DumpResult> {
  const startedAt = Date.now();
  const pageRows = options.pageRows ?? DB_TRANSFER_CONFIG.dump.rowsPerChunk * 10;
  const chunkSize = DB_TRANSFER_CONFIG.dump.rowsPerChunk;
  const hashCap = DB_TRANSFER_CONFIG.verify.maxRowsForContentHash;

  // Raw time text from the very first query — this is the whole ballgame
  // for timestamp fidelity (see codec.ts).
  applyPgTypeOverrides(pgTypes);

  options.log.info(`Reading schema from ${describeConnection(options.connectionUrl)} …`);
  const schemas = await introspectTables(options.client);
  const filtered = options.onlyTables
    ? schemas.filter((t) => options.onlyTables?.includes(t.name))
    : schemas;

  if (filtered.length === 0) {
    throw new Error(
      "Refusing to write an empty backup: no public tables were found on the source. " +
      "Check the connection URL — an empty file would silently 'succeed'.",
    );
  }

  const plan = buildLoadPlan(filtered);

  const sourceInfo: BackupSourceInfo = {
    role: options.role,
    label: options.label,
    connection: redactConnectionString(options.connectionUrl),
    fingerprint: fingerprintConnection(options.connectionUrl)
      ? describeConnection(options.connectionUrl)
      : "unknown",
  };

  const header: BackupHeader = {
    kind: "header",
    format: DB_TRANSFER_CONFIG.format,
    formatVersion: DB_TRANSFER_CONFIG.formatVersion,
    createdAt: new Date().toISOString(),
    source: sourceInfo,
    loadOrder: plan.loadOrder,
    tables: filtered,
    cyclicFks: plan.cyclicFks,
  };

  const outFile = options.outFile;
  const partPath = `${outFile}.part`;
  mkdirSync(dirname(outFile), { recursive: true });
  if (existsSync(partPath)) unlinkSync(partPath);

  const hasher = createLineHasher();
  const rowCounts: Record<string, number> = {};
  const contentHashes: Record<string, string | null> = {};
  let totalRows = 0;

  const stream = createWriteStream(partPath, { encoding: "utf8" });

  try {
    const emit = async (value: unknown): Promise<void> => {
      const line = JSON.stringify(value);
      hasher.update(line);
      await writeChunk(stream, `${line}\n`);
    };

    await emit(header);

    const tablesByName = new Map(filtered.map((table) => [table.name, table]));
    for (const tableName of plan.loadOrder) {
      const table = tablesByName.get(tableName);
      if (!table) continue;
      const expected = await tableRowCount(options.client, table.name);
      let written = 0;
      let collected = 0;
      let hashOverflow = false;
      const canonical: string[] = [];
      let buffer: BackupRowsLine["values"] = [];
      let seq = 0;

      if (expected === 0) {
        rowCounts[table.name] = 0;
        contentHashes[table.name] = contentHash([]);
        options.log.table(table.name, 0);
        continue;
      }

      for await (const row of readTableRows(options.client, table, pageRows)) {
        const canonicalRow = canonicalRowString(row);
        if (!hashOverflow) {
          if (collected < hashCap) {
            canonical.push(canonicalRow);
            collected += 1;
          } else {
            hashOverflow = true;
            canonical.length = 0;
          }
        }

        buffer.push(encodeRow(row));
        written += 1;
        totalRows += 1;

        if (buffer.length >= chunkSize) {
          await emit({ kind: "rows", table: table.name, seq, values: buffer } satisfies BackupRowsLine);
          seq += 1;
          buffer = [];
        }
        options.log.progress(table.name, written, expected);
      }

      if (buffer.length > 0) {
        await emit({ kind: "rows", table: table.name, seq, values: buffer } satisfies BackupRowsLine);
      }

      options.log.clearProgress();
      rowCounts[table.name] = written;
      contentHashes[table.name] = hashOverflow ? null : contentHash(canonical);
      options.log.table(table.name, written);

      if (written !== expected) {
        throw new Error(
          `Row count drifted mid-dump on ${table.name}: counted ${expected}, read ${written}. ` +
          "The source is being written to concurrently — rerun when writes have quiesced.",
        );
      }
      if (hashOverflow) {
        options.log.warn(
          `${table.name}: over ${hashCap} rows — content hash skipped, verification will use row counts only.`,
        );
      }
    }

    const footer: BackupFooter = {
      kind: "footer",
      totalRows,
      rowCounts,
      contentHashes,
      sha256: hasher.digest(),
    };
    await writeChunk(stream, `${JSON.stringify(footer)}\n`);
    await new Promise<void>((resolve, reject) => {
      stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });

    // Only NOW does the file become visible under its real name.
    if (existsSync(outFile)) unlinkSync(outFile);
    renameSync(partPath, outFile);

    const ms = Date.now() - startedAt;
    options.log.ok(
      `Wrote ${totalRows} rows across ${filtered.length} tables → ${outFile}`,
    );

    return {
      path: outFile,
      partPath,
      header,
      footer,
      bytes: statSync(outFile).size,
      ms,
    };
  } catch (error) {
    // Never leave a half-written artifact that could later be "found".
    try {
      stream.destroy();
    } catch {
      /* already closed */
    }
    if (existsSync(partPath)) {
      try {
        unlinkSync(partPath);
      } catch {
        /* best effort */
      }
    }
    throw error;
  }
}
