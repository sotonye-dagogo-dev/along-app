/**
 * Shared row readers.
 *
 * Both the writer and the verifier must produce bytes from the SAME column
 * projection, in the SAME order, with the SAME type parsers — otherwise a
 * content hash would disagree for reasons that have nothing to do with
 * data. One implementation, used by both sides, is what makes the hash
 * comparison meaningful.
 */

import { quoteIdents, quoteIdent, type Queryable } from "./introspect";
import type { BackupTableSchema } from "./types";

export async function tableRowCount(client: Queryable, table: string): Promise<number> {
  const result = await client.query<{ c: string | number }>(
    `SELECT COUNT(*) AS c FROM ${quoteIdent(table)}`,
  );
  return Number(result.rows[0]?.c ?? 0);
}

/**
 * Stream a table's rows in the header's column order.
 *
 * Tables with a primary key are read in PK order (deterministic file
 * output); tables without one are read in a single query. Content hashing
 * is order-independent, so neither choice affects verification.
 */
export async function* readTableRows(
  client: Queryable,
  table: BackupTableSchema,
  pageRows: number,
): AsyncGenerator<unknown[]> {
  const columns = table.columns.map((c) => c.name);
  if (columns.length === 0) return;
  const projection = quoteIdents(columns);

  if (table.primaryKey.length === 0) {
    const result = await client.query(`SELECT ${projection} FROM ${quoteIdent(table.name)}`);
    for (const row of result.rows) yield columns.map((name) => row[name]);
    return;
  }

  const orderBy = quoteIdents(table.primaryKey);
  let offset = 0;
  for (;;) {
    const result = await client.query(
      `SELECT ${projection} FROM ${quoteIdent(table.name)} ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
      [pageRows, offset],
    );
    if (result.rows.length === 0) return;
    for (const row of result.rows) yield columns.map((name) => row[name]);
    if (result.rows.length < pageRows) return;
    offset += result.rows.length;
  }
}
