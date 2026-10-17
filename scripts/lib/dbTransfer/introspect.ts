/**
 * Schema introspection + load planning.
 *
 * Everything is read from `pg_catalog` / `information_schema` rather than
 * from the Prisma client, so the tool transfers WHATEVER IS ACTUALLY THERE
 * (tables the ORM does not know about included) instead of whatever the
 * current schema file predicts.
 *
 * The load plan answers the one question a restore must get right:
 * **in which order can rows be inserted so no foreign key is violated?**
 * Tables are grouped into strongly-connected components (Tarjan), the
 * components are topologically sorted (dependencies first), and every FK
 * that points into the SAME component is marked cyclic — those columns are
 * written NULL during the insert pass and restored by a second UPDATE pass,
 * which makes `Post.quotedPostId` and `User.invitedById` safe regardless of
 * row order.
 */

import type { BackupForeignKey, BackupTableSchema } from "./types";
import { DB_TRANSFER_CONFIG } from "../../../app/lib/config/dbTransfer";

/* ------------------------------------------------------------------ *
 * Identifiers
 * ------------------------------------------------------------------ */

/** Quote an SQL identifier safely (source table names are untrusted input). */
export function quoteIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

/** Quote a comma-separated column list. */
export function quoteIdents(names: readonly string[]): string {
  return names.map(quoteIdent).join(", ");
}

/** Quote a SQL string literal safely (table names become count aliases). */
export function quoteLiteral(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Tables a restore is allowed to write.
 *
 * Prisma's migration bookkeeping (`_prisma_migrations`) is captured in the
 * backup for completeness but NEVER replayed — the target owns its own
 * migration history, recreated by `prisma migrate deploy`.
 */
export function restorableTables(
  header: { tables: readonly BackupTableSchema[] },
): BackupTableSchema[] {
  const bookkeeping = DB_TRANSFER_CONFIG.bookkeepingTables as readonly string[];
  return header.tables.filter((t) => !bookkeeping.includes(t.name));
}

/* ------------------------------------------------------------------ *
 * Introspection
 * ------------------------------------------------------------------ */

/** Minimal structural shape of a `pg` client — keeps this testable. */
export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

interface TableRow {
  table_name: string;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  ordinal_position: number;
  oid: string | number;
  data_type: string;
  udt_name: string;
  is_nullable: boolean;
  column_default: string | null;
}
interface PkRow {
  table_name: string;
  column_name: string;
}

interface FkRow {
  src_table: string;
  src_column: string;
  ref_table: string;
  ref_column: string;
}

/** Tables (and table-like relkinds) that hold data worth transferring. */
export async function listTables(client: Queryable): Promise<string[]> {
  const result = await client.query<TableRow>(
    `SELECT c.relname AS table_name
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
      ORDER BY c.relname`,
  );
  return result.rows.map((row) => row.table_name);
}

/** Full column/PK/FK description for every public table. */
export async function introspectTables(client: Queryable): Promise<BackupTableSchema[]> {
  const [tables, columns, pks, fks] = await Promise.all([
    listTables(client),
    client.query<ColumnRow>(
      `SELECT c.relname AS table_name,
              a.attname AS column_name,
              a.attnum  AS ordinal_position,
              a.atttypid AS oid,
              pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
              t.typname AS udt_name,
              NOT a.attnotnull AS is_nullable,
              pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS column_default
         FROM pg_catalog.pg_attribute a
         JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
         LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY c.relname, a.attnum`,
    ),
    client.query<PkRow>(
      `SELECT tc.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name
          AND kcu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY tc.table_name, kcu.ordinal_position`,
    ),
    client.query<FkRow>(
      `SELECT src_c.relname AS src_table,
              src_a.attname AS src_column,
              ref_c.relname AS ref_table,
              ref_a.attname AS ref_column
         FROM pg_constraint con
         JOIN pg_class src_c ON src_c.oid = con.conrelid
         JOIN pg_namespace src_n ON src_n.oid = src_c.relnamespace
         JOIN pg_class ref_c ON ref_c.oid = con.confrelid
         JOIN unnest(con.conkey) WITH ORDINALITY AS sk(attnum, ord) ON true
         JOIN unnest(con.confkey) WITH ORDINALITY AS rk(attnum, ord) ON rk.ord = sk.ord
         JOIN pg_attribute src_a ON src_a.attrelid = con.conrelid AND src_a.attnum = sk.attnum
         JOIN pg_attribute ref_a ON ref_a.attrelid = con.confrelid AND ref_a.attnum = rk.attnum
        WHERE con.contype = 'f'
          AND src_n.nspname = 'public'
        ORDER BY src_c.relname, con.conname, sk.ord`,
    ),
  ]);

  const pkByTable = new Map<string, string[]>();
  for (const row of pks.rows) {
    const list = pkByTable.get(row.table_name) ?? [];
    list.push(row.column_name);
    pkByTable.set(row.table_name, list);
  }

  const fkByTable = new Map<string, BackupForeignKey[]>();
  const nullability = new Map<string, boolean>();
  for (const row of columns.rows) {
    nullability.set(`${row.table_name}.${row.column_name}`, row.is_nullable);
  }
  for (const row of fks.rows) {
    const list = fkByTable.get(row.src_table) ?? [];
    list.push({
      column: row.src_column,
      refTable: row.ref_table,
      refColumn: row.ref_column,
      isNullable: nullability.get(`${row.src_table}.${row.src_column}`) ?? false,
    });
    fkByTable.set(row.src_table, list);
  }

  const columnsByTable = new Map<string, BackupTableSchema["columns"]>();
  for (const row of columns.rows) {
    const list = columnsByTable.get(row.table_name) ?? [];
    list.push({
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      isNullable: row.is_nullable,
      ordinalPosition: Number(row.ordinal_position),
      oid: Number(row.oid),
      hasSerialDefault: /^nextval\s*\(/i.test((row.column_default ?? "").trim()),
      hasDefault: (row.column_default ?? "").trim().length > 0,
    });
    columnsByTable.set(row.table_name, list);
  }

  return tables.map((name) => ({
    name,
    columns: columnsByTable.get(name) ?? [],
    primaryKey: pkByTable.get(name) ?? [],
    foreignKeys: fkByTable.get(name) ?? [],
  }));
}

/* ------------------------------------------------------------------ *
 * Load planning — Tarjan SCC + topological ordering
 * ------------------------------------------------------------------ */

export interface LoadPlan {
  /** Tables in safe insert order (parents before children). */
  loadOrder: string[];
  /**
   * FK columns that must be deferred (they point into the same cycle).
   * Non-nullable members are a hard error — the plan throws for them.
   */
  cyclicFks: Array<{ table: string; columns: string[] }>;
}

interface TarjanState {
  index: number;
  low: number;
  onStack: boolean;
}

/**
 * Tarjan's strongly-connected-components. Iterative (no recursion) so a
 * pathological schema cannot blow the stack.
 */
export function stronglyConnectedComponents(
  nodes: readonly string[],
  edges: ReadonlyMap<string, readonly string[]>,
): string[][] {
  const state = new Map<string, TarjanState>();
  const stack: string[] = [];
  const components: string[][] = [];
  let index = 0;

  const sortedNodes = [...nodes].sort();
  const sortedEdges = new Map<string, string[]>(
    [...edges.entries()].map(([k, v]) => [k, [...v].sort()]),
  );

  for (const root of sortedNodes) {
    if (state.has(root)) continue;

    // frame: [node, iterator over successors]
    const frames: Array<[string, string[], number]> = [[root, sortedEdges.get(root) ?? [], 0]];
    state.set(root, { index, low: index, onStack: true });
    index += 1;
    stack.push(root);

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      const [node, successors, cursor] = frame;

      if (cursor < successors.length) {
        frame[2] = cursor + 1;
        const next = successors[cursor];
        const nextIndex = state.get(next);
        if (!nextIndex) {
          state.set(next, { index, low: index, onStack: true });
          index += 1;
          stack.push(next);
          frames.push([next, sortedEdges.get(next) ?? [], 0]);
        } else if (nextIndex.onStack) {
          const current = state.get(node);
          if (current) current.low = Math.min(current.low, nextIndex.index);
        }
        continue;
      }

      frames.pop();
      const current = state.get(node);
      if (current && current.low === current.index) {
        const component: string[] = [];
        for (;;) {
          const member = stack.pop();
          if (member === undefined) break;
          const memberState = state.get(member);
          if (memberState) memberState.onStack = false;
          component.push(member);
          if (member === node) break;
        }
        components.push(component.sort());
      }

      const parent = frames[frames.length - 1];
      if (parent && current) {
        const parentState = state.get(parent[0]);
        if (parentState) parentState.low = Math.min(parentState.low, current.low);
      }
    }
  }

  return components;
}

/**
 * Derive a deterministic insert order and the set of FK columns that must
 * be deferred because their endpoints participate in a reference cycle.
 */
export function buildLoadPlan(tables: readonly BackupTableSchema[]): LoadPlan {
  const names = tables.map((t) => t.name);
  const nameSet = new Set(names);

  const dependencies = new Map<string, string[]>();
  for (const table of tables) {
    const deps = new Set<string>();
    for (const fk of table.foreignKeys) {
      // Only in-schema references matter (prisma never emits cross-schema
      // FKs here, but a hand-made table might).
      if (nameSet.has(fk.refTable) && fk.refTable !== table.name) deps.add(fk.refTable);
      if (fk.refTable === table.name) deps.add(table.name);
    }
    dependencies.set(table.name, [...deps]);
  }

  const components = stronglyConnectedComponents(names, dependencies);
  const componentOf = new Map<string, number>();
  components.forEach((component, id) => component.forEach((n) => componentOf.set(n, id)));

  // Dependency edges between components: src depends on dst ⇒ dst first.
  const componentDeps = new Map<number, Set<number>>();
  const indegree = new Map<number, number>();
  components.forEach((_, id) => {
    componentDeps.set(id, new Set());
    indegree.set(id, 0);
  });
  for (const table of tables) {
    const src = componentOf.get(table.name);
    if (src === undefined) continue;
    for (const fk of table.foreignKeys) {
      const dst = componentOf.get(fk.refTable);
      if (dst === undefined || dst === src) continue;
      const set = componentDeps.get(src);
      if (set && !set.has(dst)) {
        set.add(dst);
        indegree.set(src, (indegree.get(src) ?? 0) + 1);
      }
    }
  }

  // Kahn, picking the smallest component id at each step → reproducible order.
  const ready = components
    .map((_, id) => id)
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort((a, b) => a - b);
  const orderedComponents: number[] = [];
  while (ready.length > 0) {
    const id = ready.shift();
    if (id === undefined) break;
    orderedComponents.push(id);
    for (const [otherId, deps] of componentDeps) {
      if (otherId === id || !deps.has(id)) continue;
      const next = (indegree.get(otherId) ?? 0) - 1;
      indegree.set(otherId, next);
      if (next === 0) {
        ready.push(otherId);
        ready.sort((a, b) => a - b);
      }
    }
  }

  // Cycle among components is impossible after SCC condensation; if it
  // happens anyway we still emit every table rather than dropping data.
  const emitted = new Set(orderedComponents);
  components.forEach((_, id) => {
    if (!emitted.has(id)) orderedComponents.push(id);
  });

  const loadOrder = orderedComponents.flatMap((id) => components[id] ?? []);

  const cyclicByTable = new Map<string, string[]>();
  for (const table of tables) {
    const deferred: string[] = [];
    for (const fk of table.foreignKeys) {
      const src = componentOf.get(table.name);
      const dst = componentOf.get(fk.refTable);
      if (src === undefined || dst === undefined || src !== dst) continue;
      if (!deferred.includes(fk.column)) deferred.push(fk.column);
      if (!fk.isNullable) {
        throw new Error(
          `Cannot plan a safe load: ${table.name}.${fk.column} participates in a ` +
            `foreign-key cycle but is NOT NULL, so it can never be populated in ` +
            `two passes. Make the column nullable or break the cycle in the schema.`,
        );
      }
    }
    if (deferred.length > 0) {
      cyclicByTable.set(table.name, deferred.sort());
    }
  }

  return {
    loadOrder,
    cyclicFks: [...cyclicByTable.entries()]
      .map(([table, columns]) => ({ table, columns }))
      .sort((a, b) => a.table.localeCompare(b.table)),
  };
}

/* ------------------------------------------------------------------ *
 * Live target inspection
 * ------------------------------------------------------------------ */

export interface TargetState {
  tables: string[];
  /** Row counts for every table present. Missing tables are absent. */
  counts: Record<string, number>;
  hasBookkeepingTable: boolean;
  totalRows: number;
  nonEmptyTables: number;
}

export async function inspectTarget(
  client: Queryable,
  expectedTables: readonly string[],
): Promise<TargetState> {
  const present = await listTables(client);
  const presentSet = new Set(present);
  const wanted = expectedTables.filter((t) => presentSet.has(t));

  const counts: Record<string, number> = {};
  if (wanted.length > 0) {
    const selects = wanted
      .map((t) => `SELECT ${quoteLiteral(t)} AS t, COUNT(*) AS c FROM ${quoteIdent(t)}`)
      .join(" UNION ALL ");
    const result = await client.query<{ counts: unknown }>(
      `SELECT COALESCE(jsonb_object_agg(t, c), '{}'::jsonb) AS counts FROM (${selects}) AS all_counts`,
    );
    const parsed = result.rows[0]?.counts;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        counts[key] = Number(value);
      }
    }
  }

  let totalRows = 0;
  let nonEmptyTables = 0;
  for (const value of Object.values(counts)) {
    totalRows += value;
    if (value > 0) nonEmptyTables += 1;
  }

  return {
    tables: present,
    counts,
    hasBookkeepingTable: presentSet.has("_prisma_migrations"),
    totalRows,
    nonEmptyTables,
  };
}

/** Row counts for an explicit list of tables (used by verification). */
export async function countRows(
  client: Queryable,
  tables: readonly string[],
): Promise<Record<string, number>> {
  if (tables.length === 0) return {};
  const selects = tables
    .map((t) => `SELECT ${quoteLiteral(t)} AS t, COUNT(*) AS c FROM ${quoteIdent(t)}`)
    .join(" UNION ALL ");
  const result = await client.query<{ counts: unknown }>(
    `SELECT COALESCE(jsonb_object_agg(t, c), '{}'::jsonb) AS counts FROM (${selects}) AS all_counts`,
  );
  const parsed = result.rows[0]?.counts ?? {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    out[key] = Number(value);
  }
  return out;
}
