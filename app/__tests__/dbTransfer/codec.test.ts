/**
 * Codec tests — the timezone-corruption regression lives here.
 *
 * `pg-types` parses `timestamp`/`date` into JS `Date` objects interpreted in
 * the RUNNER'S local timezone. Prisma stores UTC literals in `timestamp(3)`,
 * so a naive Date round trip shifts every timestamp. These tests pin the
 * fix: time values travel as raw server text and are handed back verbatim.
 */

import { types as pgTypes } from "pg";
import {
  TIME_TYPE_OIDS,
  __resetPgTypeOverridesForTests,
  applyPgTypeOverrides,
  canonicalRowString,
  contentHash,
  decodeValue,
  encodeRow,
  encodeValue,
  rowToParams,
  toColumnParam,
  toParam,
  type PgTypeRegistry,
} from "@/scripts/lib/dbTransfer/codec";

// Captured BEFORE any override is installed, so we can still observe the
// driver's stock behaviour after the suite mutates the shared registry.
const stockTimestampParser = pgTypes.getTypeParser(TIME_TYPE_OIDS.timestamp);
const stockDateParser = pgTypes.getTypeParser(TIME_TYPE_OIDS.date);

afterEach(() => {
  __resetPgTypeOverridesForTests();
});

describe("applyPgTypeOverrides", () => {
  it("replaces the stock time parsers with identity (raw-text) parsers", () => {
    applyPgTypeOverrides(pgTypes);

    expect(pgTypes.getTypeParser(TIME_TYPE_OIDS.timestamp)("2026-10-17 12:00:00.789")).toBe(
      "2026-10-17 12:00:00.789",
    );
    expect(pgTypes.getTypeParser(TIME_TYPE_OIDS.date)("2026-10-17")).toBe("2026-10-17");
    expect(pgTypes.getTypeParser(TIME_TYPE_OIDS.timestamptz)("2026-10-17 12:00:00.789+00")).toBe(
      "2026-10-17 12:00:00.789+00",
    );
  });

  it("is idempotent and only installs once", () => {
    const calls: number[] = [];
    const registry: PgTypeRegistry = {
      setTypeParser: (oid) => {
        calls.push(oid);
      },
    };

    applyPgTypeOverrides(registry);
    applyPgTypeOverrides(registry);

    expect(calls).toHaveLength(TIME_TYPE_OIDS.timestamp === 1114 ? 3 : 3);
    expect(new Set(calls).size).toBe(3);
  });

  it("documents WHY the override is needed: the stock parser yields a Date", () => {
    // Stock behaviour — a Date object, already interpreted through the local
    // timezone. On a non-UTC machine this is NOT the literal we asked for.
    const parsed = stockTimestampParser("2026-10-17 12:00:00.789") as unknown;
    expect(parsed).toBeInstanceOf(Date);

    const offsetMinutes = new Date("2026-10-17T12:00:00.789Z").getTimezoneOffset();
    if (offsetMinutes !== 0) {
      // The instant drifted purely because of where this test is running.
      expect((parsed as Date).toISOString()).not.toBe("2026-10-17T12:00:00.789Z");
    }

    // Same hazard for `date`, which the stock parser turns into midnight
    // LOCAL time — i.e. the previous day on any UTC-positive host.
    const parsedDate = stockDateParser("2026-10-17") as unknown;
    expect(parsedDate).toBeInstanceOf(Date);
    if (offsetMinutes !== 0) {
      expect((parsedDate as Date).toISOString()).not.toBe("2026-10-17T00:00:00.000Z");
    }
  });
});

describe("encodeValue / toParam round trip", () => {
  it("preserves a timestamp literal byte-for-byte (the corruption fix)", () => {
    const literal = "2026-10-17 12:00:00.789";

    // Strings are carried untagged — no encoding ambiguity to resolve.
    const encoded = encodeValue(literal);
    expect(encoded).toBe(literal);

    // decode + toParam is what actually reaches Postgres as a bind param.
    expect(toParam(decodeValue(encoded))).toBe(literal);
    expect(rowToParams([encoded])[0]).toBe(literal);
  });

  it("preserves a date literal and a timestamptz literal", () => {
    expect(toParam(decodeValue(encodeValue("2026-10-17")))).toBe("2026-10-17");
    expect(toParam(decodeValue(encodeValue("2026-10-17 12:00:00.789+00")))).toBe(
      "2026-10-17 12:00:00.789+00",
    );
  });

  it("carries primitive values unchanged", () => {
    expect(toParam(decodeValue(encodeValue("hello")))).toBe("hello");
    expect(toParam(decodeValue(encodeValue(true)))).toBe(true);
    expect(toParam(decodeValue(encodeValue(42)))).toBe(42);
    expect(toParam(decodeValue(encodeValue(3.14)))).toBe(3.14);
    expect(toParam(decodeValue(encodeValue(null)))).toBe(null);
    expect(toParam(decodeValue(encodeValue(undefined)))).toBe(null);
  });

  it("canonicalizes floating-point display noise across PostgreSQL providers", () => {
    expect(canonicalRowString([6.431321621211683])).toBe(
      canonicalRowString([6.43132162121168]),
    );
  });

  it("survives NaN and Infinity, which JSON and pg would silently turn into null", () => {
    const nan = encodeValue(Number.NaN);
    expect(nan).toEqual({ $n: "NaN" });
    // Postgres gets its own literal, so a `double precision` column keeps
    // NaN instead of receiving NULL.
    expect(toParam(decodeValue(nan))).toBe("NaN");

    const inf = encodeValue(Number.POSITIVE_INFINITY);
    expect(inf).toEqual({ $n: "Infinity" });
    expect(toParam(decodeValue(inf))).toBe("Infinity");

    const negInf = encodeValue(Number.NEGATIVE_INFINITY);
    expect(negInf).toEqual({ $n: "-Infinity" });
    expect(toParam(decodeValue(negInf))).toBe("-Infinity");
  });

  it("round-trips Buffers through base64", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255]);
    const encoded = encodeValue(bytes);
    expect(encoded).toEqual({ $b: bytes.toString("base64") });

    const decoded = toParam(decodeValue(encoded));
    expect(Buffer.isBuffer(decoded)).toBe(true);
    expect((decoded as Buffer).equals(bytes)).toBe(true);
  });

  it("round-trips Uint8Array", () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const decoded = toParam(decodeValue(encodeValue(bytes)));
    expect(Buffer.from(decoded as Buffer).toString("hex")).toBe("090807");
  });

  it("carries BigInt as a numeric string (pg cannot bind BigInt)", () => {
    const encoded = encodeValue(BigInt("9007199254740993"));
    expect(encoded).toEqual({ $i: "9007199254740993" });

    const decoded = toParam(decodeValue(encoded));
    expect(typeof decoded).toBe("string");
    expect(decoded).toBe("9007199254740993");
  });

  it("defensively converts a Date (should not occur once parsers are overridden)", () => {
    const encoded = encodeValue(new Date("2026-10-17T12:00:00.789Z"));
    expect(encoded).toEqual({ $t: "2026-10-17T12:00:00.789Z" });
  });

  it("round-trips a text[] column as a real pg array", () => {
    const encoded = encodeValue(["a", "b", "c"]);
    expect(encoded).toEqual({ $r: ["a", "b", "c"] });

    const decoded = toParam(decodeValue(encoded));
    expect(decoded).toEqual(["a", "b", "c"]);
  });

  it("round-trips nested arrays element-by-element", () => {
    const encoded = encodeValue(["x", null, "z"]);
    expect(toParam(decodeValue(encoded))).toEqual(["x", null, "z"]);
  });

  it("binds empty JSON arrays as JSON text instead of PostgreSQL array literals", () => {
    expect(toColumnParam([], { jsonArray: true })).toBe("[]");
    expect(rowToParams([{ $r: [] }], { jsonArray: true })).toEqual(["[]"]);
    expect(toParam([])).toEqual([]);
  });

  it("round-trips a Json column through JSON text", () => {
    const value = { nested: { a: 1 }, list: [1, 2], flag: false };
    const encoded = encodeValue(value);
    expect(encoded).toEqual({ $j: '{"flag":false,"list":[1,2],"nested":{"a":1}}' });

    // The bind parameter must be JSON TEXT, which Postgres then parses.
    const decoded = toParam(decodeValue(encoded));
    expect(typeof decoded).toBe("string");
    expect(JSON.parse(decoded as string)).toEqual(value);
  });

  it("canonicalizes nested JSON object key order for cross-provider hashes", () => {
    expect(encodeValue({ b: { z: 1, a: 2 }, a: 3 })).toEqual({
      $j: '{"a":3,"b":{"a":2,"z":1}}',
    });
  });

  it("falls back to JSON text for an array containing structured cells", () => {
    const decoded = toParam(decodeValue(encodeValue([{ a: 1 }, "plain"])));
    expect(typeof decoded).toBe("string");
  });

  it("never throws on an unexpected input", () => {
    expect(() => encodeValue(Symbol("x"))).not.toThrow();
    expect(() => encodeValue(() => undefined)).not.toThrow();
  });
});

describe("encodeRow", () => {
  it("encodes every cell and keeps positional alignment with the header", () => {
    const row = ["id-1", new Date("2026-01-01T00:00:00Z"), null, ["a"], { k: "v" }];
    const encoded = encodeRow(row);

    expect(encoded).toHaveLength(5);
    expect(encoded[0]).toBe("id-1");
    expect(encoded[2]).toBeNull();
    expect(encoded[3]).toEqual({ $r: ["a"] });
  });
});

describe("contentHash", () => {
  it("is order-independent so a restored table matches regardless of storage order", () => {
    const a = contentHash(['["1"]', '["2"]', '["3"]']);
    const b = contentHash(['["3"]', '["1"]', '["2"]']);
    expect(a).toBe(b);
  });

  it("is stable and deterministic for the same content", () => {
    expect(contentHash(["x", "y"])).toBe(contentHash(["y", "x"]));
    expect(contentHash(["x", "y"])).not.toBe(contentHash(["x", "z"]));
  });

  it("distinguishes duplicate rows from a single row", () => {
    expect(contentHash(["a", "a"])).not.toBe(contentHash(["a"]));
  });

  it("hashes an empty table to a stable value (0 rows still compares equal)", () => {
    expect(contentHash([])).toBe(contentHash([]));
    expect(contentHash([])).toMatch(/^[0-9a-f]{64}$/);
    expect(contentHash([])).not.toBe(contentHash([""]));
  });

  it("does not mutate the caller's array", () => {
    const input = ['["b"]', '["a"]'];
    contentHash(input);
    expect(input).toEqual(['["b"]', '["a"]']);
  });
});

describe("canonicalRowString", () => {
  it("produces a compact, tagged representation with no raw newline bytes", () => {
    const canonical = canonicalRowString(["line\nbreak", null, 5]);
    expect(canonical).toBe('["line\\nbreak",null,5]');
    expect(canonical).not.toContain("\n");
  });
});
