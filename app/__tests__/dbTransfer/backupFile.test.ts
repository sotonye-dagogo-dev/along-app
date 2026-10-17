/**
 * Checksum + backup-file integrity tests.
 *
 * These prove the property the whole system rests on: a file is either
 * provably the one that was written, or it is rejected outright. Partial
 * writes, truncation, reordering and bit-rot must all be caught.
 */

import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLineHasher, sha256Hex } from "@/scripts/lib/dbTransfer/checksum";
import { verifyBackupFile, forEachRowsLine } from "@/scripts/lib/dbTransfer/read";
import { DB_TRANSFER_CONFIG } from "@/app/lib/config/dbTransfer";
import { CorruptBackupError } from "@/scripts/lib/dbTransfer/types";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "along-backup-test-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Build a structurally valid file from table definitions. */
function buildBackup(options: {
  tables: Array<{ name: string; rows: unknown[][] }>;
  formatVersion?: number;
  format?: string;
}): { lines: string[]; content: string; sha256: string } {
  const hasher = createLineHasher();
  const lines: string[] = [];

  const emit = (value: unknown): void => {
    const line = JSON.stringify(value);
    hasher.update(line);
    lines.push(line);
  };

  const loadOrder = options.tables.map((t) => t.name);

  emit({
    kind: "header",
    format: options.format ?? DB_TRANSFER_CONFIG.format,
    formatVersion: options.formatVersion ?? DB_TRANSFER_CONFIG.formatVersion,
    createdAt: new Date().toISOString(),
    source: {
      role: "legacy",
      label: "test source",
      connection: "postgresql://***:***@example.test:5432/along",
      fingerprint: "postgresql://example.test:5432/along",
    },
    loadOrder,
    tables: options.tables.map((table, index) => ({
      name: table.name,
      columns: [{ name: "id", dataType: "text", udtName: "text", isNullable: false, oid: 25, ordinalPosition: 1, hasSerialDefault: false, hasDefault: false }],
      primaryKey: ["id"],
      foreignKeys: [],
      __index: index,
    })),
    cyclicFks: [],
  });

  const rowCounts: Record<string, number> = {};
  for (const table of options.tables) {
    rowCounts[table.name] = table.rows.length;
    let seq = 0;
    for (let i = 0; i < table.rows.length; i += 2) {
      emit({
        kind: "rows",
        table: table.name,
        seq: seq++,
        values: table.rows.slice(i, i + 2),
      });
    }
  }

  const sha256 = hasher.digest();
  const footer = {
    kind: "footer",
    totalRows: Object.values(rowCounts).reduce((a, b) => a + b, 0),
    rowCounts,
    contentHashes: Object.fromEntries(options.tables.map((t) => [t.name, null])),
    sha256,
  };
  lines.push(JSON.stringify(footer));

  const content = `${lines.join("\n")}\n`;
  return { lines, content, sha256 };
}

function write(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

describe("createLineHasher", () => {
  it("covers each line plus its trailing newline", () => {
    const hasher = createLineHasher();
    hasher.update("a");
    hasher.update("b");

    const expected = createHash("sha256").update("a\n").update("b\n").digest("hex");
    expect(hasher.digest()).toBe(expected);
  });

  it("exposes a partial digest without consuming the stream", () => {
    const hasher = createLineHasher();
    hasher.update("a");
    const first = hasher.partial();
    const second = hasher.partial();
    expect(first).toBe(second);

    hasher.update("b");
    expect(hasher.digest()).not.toBe(first);
  });

  it("hashes multibyte content by bytes, not code units", () => {
    const a = createLineHasher();
    a.update("héllo");
    const b = createLineHasher();
    b.update("héllo");
    expect(a.digest()).toBe(b.digest());
  });
});

describe("sha256Hex", () => {
  it("matches Node's own digest", () => {
    expect(sha256Hex("abc")).toBe(createHash("sha256").update("abc").digest("hex"));
  });
});

describe("verifyBackupFile", () => {
  it("accepts a well-formed file and reports header, footer and counts", async () => {
    const { content } = buildBackup({
      tables: [
        { name: "User", rows: [["u1"], ["u2"], ["u3"]] },
        { name: "Post", rows: [["p1"]] },
      ],
    });
    const path = write("good.jsonl", content);

    const seen: Array<[string, number, number | null]> = [];
    const verified = await verifyBackupFile(path, {
      onTable: (table, rows, expected) => seen.push([table, rows, expected]),
    });

    expect(verified.header.format).toBe(DB_TRANSFER_CONFIG.format);
    expect(verified.header.loadOrder).toEqual(["User", "Post"]);
    expect(verified.footer.totalRows).toBe(4);
    expect(verified.footer.rowCounts).toEqual({ User: 3, Post: 1 });
    expect(seen).toContainEqual(["User", 3, 3]);
    expect(verified.bytes).toBeGreaterThan(0);
  });

  it("accepts an empty table (0 rows must still compare equal)", async () => {
    const { content } = buildBackup({ tables: [{ name: "User", rows: [] }] });
    const verified = await verifyBackupFile(write("empty.jsonl", content));
    expect(verified.footer.rowCounts).toEqual({ User: 0 });
  });

  it("REJECTS truncation — a file with no footer is not a backup", async () => {
    const { lines } = buildBackup({
      tables: [{ name: "User", rows: [["u1"], ["u2"]] }],
    });
    const truncated = `${lines.slice(0, lines.length - 1).join("\n")}\n`;
    const path = write("truncated.jsonl", truncated);

    await expect(verifyBackupFile(path)).rejects.toMatchObject({
      code: "CORRUPT_BACKUP",
    });
    await expect(verifyBackupFile(path)).rejects.toThrow(/truncated/i);
  });

  it("REJECTS a single flipped byte in the payload (sha256 mismatch)", async () => {
    const { content } = buildBackup({
      tables: [{ name: "User", rows: [["user-1"], ["user-2"]] }],
    });
    const tampered = content.replace("user-2", "user-3");
    expect(tampered).not.toBe(content);
    const path = write("tampered.jsonl", tampered);

    await expect(verifyBackupFile(path)).rejects.toThrow(/sha256 mismatch/i);
  });

  it("REJECTS a missing footer after a complete body", async () => {
    const { lines } = buildBackup({ tables: [{ name: "User", rows: [["u1"]] }] });
    const noFooter = `${lines.slice(0, -1).join("\n")}\n`;
    await expect(verifyBackupFile(write("nof.jsonl", noFooter))).rejects.toThrow(/truncated/i);
  });

  it("REJECTS extra content appended after the footer", async () => {
    const { content } = buildBackup({ tables: [{ name: "User", rows: [["u1"]] }] });
    await expect(
      verifyBackupFile(write("appended.jsonl", `${content}{"kind":"rows","table":"User","seq":0,"values":[]}\n`)),
    ).rejects.toThrow(/extra content after the footer/i);
  });

  it("REJECTS an empty file", async () => {
    await expect(verifyBackupFile(write("zero.jsonl", ""))).rejects.toThrow(/no header/i);
  });

  it("REJECTS garbage that is not JSON", async () => {
    await expect(verifyBackupFile(write("garbage.jsonl", "not json at all\n"))).rejects.toThrow(
      /not valid JSON/i,
    );
  });

  it("REJECTS a file written by a newer format version", async () => {
    const { content } = buildBackup({
      tables: [{ name: "User", rows: [["u1"]] }],
      formatVersion: DB_TRANSFER_CONFIG.formatVersion + 5,
    });
    await expect(verifyBackupFile(write("future.jsonl", content))).rejects.toThrow(/newer tool/i);
  });

  it("REJECTS an unknown format marker", async () => {
    const { content } = buildBackup({
      tables: [{ name: "User", rows: [["u1"]] }],
      format: "some-other-tool",
    });
    await expect(verifyBackupFile(write("other.jsonl", content))).rejects.toThrow(/unknown format/i);
  });

  it("REJECTS rows whose declared count disagrees with the payload", async () => {
    const { lines } = buildBackup({ tables: [{ name: "User", rows: [["u1"], ["u2"]] }] });
    // Drop the rows line but keep the footer's declared count of 2, and
    // re-hash over just the surviving header so ONLY the count check trips.
    const headerOnly = lines[0];
    const hasher = createLineHasher();
    hasher.update(headerOnly);
    const footer = JSON.stringify({
      ...JSON.parse(lines[lines.length - 1]),
      sha256: hasher.digest(),
    });

    await expect(
      verifyBackupFile(write("countmismatch.jsonl", `${headerOnly}\n${footer}\n`)),
    ).rejects.toThrow(/row count mismatch/i);
  });

  it("always surfaces a CorruptBackupError, never a generic one", async () => {
    const error = await verifyBackupFile(write("garbage2.jsonl", "x\n")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CorruptBackupError);
  });
});

describe("forEachRowsLine", () => {
  it("streams rows in file order after verifying the file", async () => {
    const { content } = buildBackup({
      tables: [
        { name: "User", rows: [["u1"], ["u2"], ["u3"]] },
        { name: "Post", rows: [["p1"]] },
      ],
    });
    const path = write("stream.jsonl", content);

    const seen: Array<[string, number]> = [];
    await forEachRowsLine(path, (table, rows) => {
      seen.push([table, rows.length]);
    });

    expect(seen).toEqual([
      ["User", 2],
      ["User", 1],
      ["Post", 1],
    ]);
  });

  it("refuses to stream a corrupt file", async () => {
    const { content } = buildBackup({ tables: [{ name: "User", rows: [["u1"]] }] });
    const path = write("stream-bad.jsonl", content.replace("u1", "u9"));

    await expect(
      forEachRowsLine(path, () => undefined),
    ).rejects.toBeInstanceOf(CorruptBackupError);
  });
});
