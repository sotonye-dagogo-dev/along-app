/**
 * Value codec + Postgres type-parser overrides.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (the timezone trap)
 * ────────────────────────────────────────────────────────────────────────
 * `pg-types` parses `timestamp` (OID 1114), `timestamptz` (1184) and `date`
 * (1082) into JS `Date` objects **interpreted in the process's local
 * timezone**:
 *
 *     "2026-10-17 12:00:00.789"  →  2026-10-17T11:00:00.789Z   (UTC+1 host)
 *
 * Prisma maps `DateTime` → `timestamp(3)` WITHOUT time zone and stores UTC
 * literals, so a naive `Date → JSON → INSERT` round trip silently shifts
 * every timestamp in the database by the runner's UTC offset.
 *
 * The fix: never let `Date` objects cross the wire. Type parsers are
 * overridden to return the RAW SERVER TEXT, that text is tagged, and the
 * exact same text is handed back to Postgres on insert — so the value that
 * lands in the target is byte-identical to the value that left the source.
 *
 * Everything else is tagged too, because JSON cannot natively hold Buffers,
 * BigInts, `NaN`/`Infinity`, or an unambiguously-typed object.
 */

import { createHash } from "node:crypto";
import type { EncodedValue } from "./types";

/** OIDs whose default parser shifts values through the local timezone. */
export const TIME_TYPE_OIDS = {
  timestamp: 1114,
  timestamptz: 1184,
  date: 1082,
} as const;

const TIME_OIDS = Object.values(TIME_TYPE_OIDS);

/** Structural shape of `pg.types` — keeps this module free of a `pg` import. */
export interface PgTypeRegistry {
  setTypeParser(oid: number, parseFn: (value: string) => unknown): void;
}

let overridesApplied = false;

/**
 * Install raw-text parsers for time types. Idempotent; must be called once
 * per process before any query that feeds a backup file.
 *
 * Takes the registry as an argument (rather than importing `pg`) so this
 * module stays dependency-free and unit-testable; callers pass `pg.types`.
 *
 * Exported (not applied at import time) so importing this module never has
 * a side effect on other `pg` consumers in the same process.
 */
export function applyPgTypeOverrides(types: PgTypeRegistry): void {
  if (overridesApplied) return;
  for (const oid of TIME_OIDS) {
    // Identity parsers: keep exactly what the server sent.
    types.setTypeParser(oid, (value: string) => value);
  }
  overridesApplied = true;
}

/** Test seam — lets a suite re-install the parsers after mutating them. */
export function __resetPgTypeOverridesForTests(): void {
  overridesApplied = false;
}

/* ------------------------------------------------------------------ *
 * Encoding (DB value → JSON-safe value)
 * ------------------------------------------------------------------ */

function isTagged(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1) return false;
  const key = keys[0];
  return key === "$t" || key === "$b" || key === "$i" || key === "$r" || key === "$j" || key === "$n";
}

function tag(key: string, payload: unknown): EncodedValue {
  return { [key]: payload };
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Turn a value returned by `pg` into something `JSON.stringify` can carry
 * without losing information.
 */
export function encodeValue(value: unknown): EncodedValue {
  if (value === null || value === undefined) return null;

  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") {
    // JSON has no NaN/Infinity — they would silently become `null`.
    if (!Number.isFinite(value as number)) {
      return tag("$n", String(value));
    }
    if (Number.isInteger(value)) return value;
    // PostgreSQL float output can differ by a final display digit after a
    // cross-provider round trip even when the stored binary value is equivalent.
    return Number((value as number).toPrecision(15));
  }
  if (t === "bigint") return tag("$i", (value as bigint).toString());
  if (value instanceof Date) {
    // Defensive: with the type overrides in place this should not happen
    // for `timestamp`/`date`, but `timestamp with time zone` may still
    // surface as a Date in some driver builds. ISO-8601 keeps the instant.
    return tag("$t", Number.isNaN(value.getTime()) ? "NaN" : value.toISOString());
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return tag("$b", value.toString("base64"));
  }
  if (value instanceof Uint8Array) {
    return tag("$b", Buffer.from(value).toString("base64"));
  }
  if (Array.isArray(value)) return tag("$r", value.map(encodeValue));
  if (t === "object") return tag("$j", stableJsonStringify(value));
  // function/symbol/unknown — not reachable from `pg`, but never crash.
  return tag("$j", JSON.stringify(String(value)));
}

/** Encode a whole row (already aligned to the header's column order). */
export function encodeRow(row: readonly unknown[]): EncodedValue[] {
  return row.map(encodeValue);
}

/**
 * Canonical, order-independent representation of a row — used for content
 * hashing. Stable for a given logical row regardless of which database
 * produced it.
 */
export function canonicalRowString(row: readonly unknown[]): string {
  return JSON.stringify(encodeRow(row));
}

/* ------------------------------------------------------------------ *
 * Decoding (JSON-safe value → pg parameter)
 * ------------------------------------------------------------------ */

function decodeTagged(key: string, payload: unknown): unknown {
  switch (key) {
    case "$t":
      // Raw server text — Postgres casts it with the target column's own
      // input function, so no timezone interpretation happens in JS.
      return typeof payload === "string" ? payload : String(payload);
    case "$b":
      return Buffer.from(String(payload), "base64");
    case "$i":
      // `pg` cannot serialize BigInt — hand back a numeric string.
      return String(payload);
    case "$n":
      return Number(payload);
    case "$r":
      return Array.isArray(payload) ? payload.map(decodeValue) : null;
    case "$j":
      return typeof payload === "string" ? safeParseJson(payload) : payload;
    default:
      return payload;
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Restore an encoded cell to a value `pg` can bind.
 *
 * Note the asymmetry: objects coming out of `$j` are returned as PARSED
 * structures and stringified again in `toParam`, so the JSON text that
 * reaches `json`/`jsonb` columns is always produced locally rather than
 * trusted from the file.
 */
export function decodeValue(value: EncodedValue): unknown {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === "string" || t === "boolean" || t === "number") return value;
  if (Array.isArray(value)) return value.map(decodeValue);
  if (isTagged(value)) {
    const key = Object.keys(value)[0];
    return decodeTagged(key, value[key]);
  }
  return value;
}

/**
 * Final shaping of a decoded cell into a `pg` bind parameter.
 * `pg` cannot bind: BigInt, Date-from-JSON, or bare nested objects for
 * non-json columns — each is converted to the representation the wire
 * protocol accepts while Postgres performs the actual cast.
 */
export function toParam(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    // `pg` serialises numbers via JSON.stringify, which turns NaN/Infinity
    // into the literal `null` — silent data loss. Hand Postgres its own
    // text literals instead, which `double precision` parses correctly.
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    // `text[]` and friends: `pg` renders a primitive JS array as a
    // Postgres array literal. Mixed/nested content falls back to JSON.
    return value.every(
      (v) => v === null || ["string", "number", "boolean"].includes(typeof v),
    )
      ? value
      : JSON.stringify(value);
  }
  return JSON.stringify(value);
}

export interface ParamOptions {
  jsonArray?: boolean;
}

export function toColumnParam(value: unknown, options: ParamOptions = {}): unknown {
  if (options.jsonArray && Array.isArray(value)) return JSON.stringify(value);
  return toParam(value);
}

/** Decode an encoded row straight into bind parameters. */
export function rowToParams(row: EncodedValue[], options: ParamOptions = {}): unknown[] {
  return row.map((v) => toColumnParam(decodeValue(v), options));
}

/* ------------------------------------------------------------------ *
 * Content hashing
 * ------------------------------------------------------------------ */

/**
 * Order-independent sha256 over a table's canonical row strings.
 * Returns `null` for an empty set ONLY when explicitly asked to — an empty
 * table still hashes (over the empty string) so "0 rows" on both sides
 * still matches.
 */
export function contentHash(canonicalStrings: readonly string[]): string {
  const sorted = [...canonicalStrings].sort();
  const hash = createHash("sha256");
  for (const line of sorted) {
    hash.update(line, "utf8");
    hash.update("\n", "utf8");
  }
  return `${hash.digest("hex")}`;
}
