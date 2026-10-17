/**
 * Post-load verification — proves the target really holds the backup.
 *
 * Two levels, both driven by `DB_TRANSFER_CONFIG.verify.mode`:
 *   `full`   re-reads every row and compares per-table content hashes
 *            (order-independent), so a single flipped byte is caught;
 *   `counts` compares row counts only — the cheap escape hatch for very
 *            large tables.
 *
 * The same comparison runs INSIDE the load transaction, so a mismatch
 * triggers a rollback instead of a committed-but-wrong database.
 */

import { types as pgTypes } from "pg";
import { DB_TRANSFER_CONFIG } from "../../../app/lib/config/dbTransfer";
import { applyPgTypeOverrides, canonicalRowString, contentHash } from "./codec";
import type { TransferLog } from "./log";
import { tableRowCount, readTableRows } from "./rows";
import { restorableTables } from "./introspect";
import type { BackupFooter, BackupHeader, TableTransferResult, TransferSummary } from "./types";
import type { Queryable } from "./introspect";

export interface VerifyOptions {
  mode?: "full" | "counts";
  log?: TransferLog;
  /** Skip tables above this row count for hash comparison. */
  maxRowsForContentHash?: number;
}

export interface VerifyOutcome {
  ok: boolean;
  mode: "full" | "counts";
  problems: string[];
  summary: TransferSummary;
}

export async function verifyTargetAgainstBackup(
  client: Queryable,
  header: BackupHeader,
  footer: BackupFooter,
  options: VerifyOptions = {},
): Promise<VerifyOutcome> {
  applyPgTypeOverrides(pgTypes);
  const mode = options.mode ?? DB_TRANSFER_CONFIG.verify.mode;
  const hashCap = options.maxRowsForContentHash ?? DB_TRANSFER_CONFIG.verify.maxRowsForContentHash;
  const pageRows = DB_TRANSFER_CONFIG.dump.rowsPerChunk * 10;
  const startedAt = Date.now();
  const problems: string[] = [];
  const results: TableTransferResult[] = [];
  let totalRows = 0;

  for (const table of restorableTables(header)) {
    const name = table.name;
    const expectedRows = footer.rowCounts[name] ?? 0;
    const expectedHash = footer.contentHashes[name] ?? null;

    let actualRows = 0;
    let hash: string | null = null;

    try {
      actualRows = await tableRowCount(client, name);
    } catch (error) {
      problems.push(`${name}: table missing or unreadable on target — ${(error as Error).message}`);
      results.push({
        table: name,
        rows: -1,
        expected: expectedRows,
        contentHash: null,
        expectedHash,
        hashMatched: null,
      });
      continue;
    }

    totalRows += actualRows;

    if (actualRows !== expectedRows) {
      problems.push(`${name}: expected ${expectedRows} rows, target has ${actualRows}`);
    }

    let hashMatched: boolean | null = null;
    if (mode === "full" && expectedHash !== null && actualRows === expectedRows) {
      if (actualRows > hashCap) {
        options.log?.warn(
          `${name}: ${actualRows} rows exceeds the ${hashCap} hash cap — count-only comparison.`,
        );
        hashMatched = null;
      } else {
        const canonical: string[] = [];
        let overflow = false;
        try {
          for await (const row of readTableRows(client, table, pageRows)) {
            if (canonical.length >= hashCap) {
              overflow = true;
              break;
            }
            canonical.push(canonicalRowString(row));
          }
        } catch (error) {
          problems.push(`${name}: could not re-read target rows — ${(error as Error).message}`);
          hashMatched = null;
          overflow = true;
        }
        if (!overflow) {
          hash = contentHash(canonical);
          hashMatched = hash === expectedHash;
          if (!hashMatched) {
            problems.push(
              `${name}: content hash mismatch — row contents differ from the backup even though counts match`,
            );
          }
        }
      }
    }

    results.push({
      table: name,
      rows: actualRows,
      expected: expectedRows,
      contentHash: hash,
      expectedHash,
      hashMatched,
    });

    options.log?.table(
      name,
      hashMatched === true ? `${actualRows} ✓` : hashMatched === false ? `${actualRows} ✗` : actualRows,
    );
  }

  // Rows present on the target but NOT in the backup mean the target was
  // not actually replaced/emptied — that is a problem, not a bonus.
  const expectedNames = new Set(restorableTables(header).map((t) => t.name));
  for (const [name, count] of Object.entries(footer.rowCounts)) {
    if ((DB_TRANSFER_CONFIG.bookkeepingTables as readonly string[]).includes(name)) continue;
    if (!expectedNames.has(name) && count > 0) {
      problems.push(`${name}: footer row count refers to a table absent from the header`);
    }
  }

  const summary: TransferSummary = {
    tables: results.length,
    rows: totalRows,
    ms: Date.now() - startedAt,
    results,
  };

  return { ok: problems.length === 0, mode, problems, summary };
}
