/**
 * CLI parsing + destructive-consent tests, and the schema-drift rules that
 * decide whether a load may proceed at all.
 *
 * The consent rules are the last line of defence before anything is
 * overwritten, so they are pinned in both directions: automation must be
 * loud, and nothing may default to "yes".
 */

import {
  confirmDestructiveAction,
  envInt,
  flagBool,
  flagString,
  hasReplaceConsent,
  parseArgs,
  resolveVerifyMode,
  safetyBackupEnabled,
  usage,
} from "@/scripts/lib/dbTransfer/cli";
import { DB_TRANSFER_CONFIG } from "@/app/lib/config/dbTransfer";
import { TransferSafetyError } from "@/scripts/lib/dbTransfer/types";
import { diffSchema, describeSchemaDiff } from "@/scripts/lib/dbTransfer/restore";
import type { BackupColumnMeta, BackupHeader, BackupTableSchema } from "@/scripts/lib/dbTransfer/types";

describe("parseArgs", () => {
  it("reads bare flags as booleans", () => {
    expect(parseArgs(["--replace", "--fresh"]).flags).toEqual({ replace: true, fresh: true });
  });

  it("reads --flag=value", () => {
    expect(parseArgs(["--source=legacy"]).flags).toEqual({ source: "legacy" });
  });

  it("reads --flag value", () => {
    expect(parseArgs(["--source", "legacy"]).flags).toEqual({ source: "legacy" });
  });

  it("reads --no-flag as false", () => {
    expect(parseArgs(["--no-replace"]).flags).toEqual({ replace: false });
  });

  it("collects positionals", () => {
    const parsed = parseArgs(["first", "--replace", "second"]);
    expect(parsed.positionals).toEqual(["first", "second"]);
    expect(parsed.flags).toEqual({ replace: true });
  });

  it("treats everything after -- as positional", () => {
    expect(parseArgs(["--replace", "--", "--not-a-flag"]).positionals).toEqual(["--not-a-flag"]);
  });

  it("handles an empty argument list", () => {
    expect(parseArgs([])).toEqual({ flags: {}, positionals: [] });
  });

  it("lets the last occurrence win", () => {
    expect(parseArgs(["--source=a", "--source=b"]).flags.source).toBe("b");
  });
});

describe("flag accessors", () => {
  it("reads string flags, falling back across aliases", () => {
    const args = parseArgs(["--file=dump.jsonl"]);
    expect(flagString(args, "file")).toBe("dump.jsonl");
    expect(flagString(args, "missing")).toBeUndefined();
    expect(flagString(args, "file", "missing")).toBe("dump.jsonl");
  });

  it("treats an empty string as absent", () => {
    expect(flagString(parseArgs(["--file="]), "file")).toBeUndefined();
  });

  it("parses boolean-ish strings", () => {
    expect(flagBool(parseArgs(["--flag=true"]), "flag")).toBe(true);
    expect(flagBool(parseArgs(["--flag=yes"]), "flag")).toBe(true);
    expect(flagBool(parseArgs(["--flag=1"]), "flag")).toBe(true);
    expect(flagBool(parseArgs(["--flag=false"]), "flag")).toBe(false);
    expect(flagBool(parseArgs(["--flag=off"]), "flag")).toBe(false);
    expect(flagBool(parseArgs([]), "flag")).toBe(false);
  });
});

describe("hasReplaceConsent", () => {
  it("accepts --replace", () => {
    expect(hasReplaceConsent(parseArgs(["--replace"]))).toBe(true);
  });

  it("accepts the --yes alias for scripted runs", () => {
    expect(hasReplaceConsent(parseArgs(["--yes"]))).toBe(true);
  });

  it("refuses when nothing was asked for", () => {
    expect(hasReplaceConsent(parseArgs([]))).toBe(false);
    expect(hasReplaceConsent(parseArgs(["--fresh"]))).toBe(false);
  });

  it("does not treat --no-replace as consent", () => {
    expect(hasReplaceConsent(parseArgs(["--no-replace"]))).toBe(false);
  });
});

describe("confirmDestructiveAction", () => {
  it("proceeds immediately when consent was given", async () => {
    await expect(
      confirmDestructiveAction({ summary: "x", consentGiven: true }),
    ).resolves.toBe(true);
  });

  it("REFUSES silently in a non-interactive session without consent", async () => {
    await expect(
      confirmDestructiveAction({
        summary: "This would overwrite 1200 rows.",
        consentGiven: false,
        prompt: { isTty: false },
      }),
    ).rejects.toBeInstanceOf(TransferSafetyError);

    await expect(
      confirmDestructiveAction({ summary: "x", consentGiven: false, prompt: { isTty: false } }),
    ).rejects.toThrow(/refusing to overwrite/i);
  });

  it("names the flag that grants consent in the remedy", async () => {
    const error = await confirmDestructiveAction({
      summary: "x",
      consentGiven: false,
      prompt: { isTty: false },
    }).catch((e: unknown) => e as TransferSafetyError);

    expect((error as TransferSafetyError).remedy).toContain(
      `--${DB_TRANSFER_CONFIG.destructive.replaceFlag}`,
    );
  });

  it("prompts a human and only accepts an explicit yes", async () => {
    const ask = jest.fn().mockResolvedValue("y");
    await expect(
      confirmDestructiveAction({ summary: "x", consentGiven: false, prompt: { isTty: true, ask } }),
    ).resolves.toBe(true);
    expect(ask).toHaveBeenCalled();
  });

  it("treats anything but yes as a no", async () => {
    const ask = jest.fn().mockResolvedValue("n");
    await expect(
      confirmDestructiveAction({ summary: "x", consentGiven: false, prompt: { isTty: true, ask } }),
    ).resolves.toBe(false);

    const ask2 = jest.fn().mockResolvedValue("");
    await expect(
      confirmDestructiveAction({ summary: "x", consentGiven: false, prompt: { isTty: true, ask: ask2 } }),
    ).resolves.toBe(false);
  });
});

describe("env overrides", () => {
  it("reads an integer within bounds", () => {
    expect(envInt({ A: "30" }, "A", 10)).toBe(30);
  });

  it("clamps to the configured bounds", () => {
    expect(envInt({ A: "1" }, "A", 10, { min: 5 })).toBe(5);
    expect(envInt({ A: "999" }, "A", 10, { max: 100 })).toBe(100);
  });

  it("falls back when unset or unparseable", () => {
    expect(envInt({}, "A", 10)).toBe(10);
    expect(envInt({ A: "abc" }, "A", 10)).toBe(10);
  });
});

describe("safetyBackupEnabled", () => {
  it("is on by default", () => {
    expect(safetyBackupEnabled({})).toBe(true);
  });

  it("can be turned off explicitly", () => {
    for (const value of ["false", "0", "no", "off", "FALSE"]) {
      expect(safetyBackupEnabled({ [DB_TRANSFER_CONFIG.safetyBackup.envKey]: value })).toBe(false);
    }
  });

  it("treats anything else as enabled", () => {
    expect(safetyBackupEnabled({ [DB_TRANSFER_CONFIG.safetyBackup.envKey]: "yes" })).toBe(true);
  });
});

describe("resolveVerifyMode", () => {
  it("prefers the CLI flag over the environment", () => {
    expect(
      resolveVerifyMode({ [DB_TRANSFER_CONFIG.verify.envKey]: "counts" }, "full"),
    ).toBe("full");
  });

  it("falls back to the environment, then the registry default", () => {
    expect(resolveVerifyMode({ [DB_TRANSFER_CONFIG.verify.envKey]: "counts" })).toBe("counts");
    expect(resolveVerifyMode({})).toBe(DB_TRANSFER_CONFIG.verify.mode);
    expect(resolveVerifyMode({ [DB_TRANSFER_CONFIG.verify.envKey]: "junk" })).toBe(
      DB_TRANSFER_CONFIG.verify.mode,
    );
  });
});

describe("usage", () => {
  it("documents the destructive flag and the env knobs", () => {
    const text = usage("title", ["line"]);
    expect(text).toContain("title");
    expect(text).toContain("line");
    expect(text).toContain(`--${DB_TRANSFER_CONFIG.destructive.replaceFlag}`);
    expect(text).toContain(DB_TRANSFER_CONFIG.resume.envKey);
    expect(text).toContain(DB_TRANSFER_CONFIG.verify.envKey);
    expect(text).toContain(DB_TRANSFER_CONFIG.safetyBackup.envKey);
  });
});

describe("value flags never swallow their neighbour", () => {
  it("keeps a positional after a boolean flag", () => {
    const parsed = parseArgs(["--replace", "backup.jsonl"]);
    expect(parsed.flags).toEqual({ replace: true });
    expect(parsed.positionals).toEqual(["backup.jsonl"]);
  });

  it("still consumes the value for a declared value flag", () => {
    const parsed = parseArgs(["--target", "supabase", "--replace"]);
    expect(parsed.flags).toEqual({ target: "supabase", replace: true });
    expect(parsed.positionals).toEqual([]);
  });

  it("does not consume the following token when it is itself a flag", () => {
    const parsed = parseArgs(["--source", "--target"]);
    expect(parsed.flags).toEqual({ source: true, target: true });
  });

  it("treats a value flag with no value as a boolean rather than eating a flag", () => {
    expect(parseArgs(["--file", "--replace"]).flags).toEqual({ file: true, replace: true });
  });
});

/* ── schema drift ─────────────────────────────────────────────────────── */

function column(name: string, overrides: Partial<BackupColumnMeta> = {}): BackupColumnMeta {
  return {
    name,
    dataType: "text",
    udtName: "text",
    isNullable: false,
    ordinalPosition: 1,
    oid: 25,
    hasSerialDefault: false,
    hasDefault: false,
    ...overrides,
  };
}

function table(name: string, columns: string[], nullable: string[] = []): BackupTableSchema {
  return {
    name,
    columns: columns.map((c) => column(c, { isNullable: nullable.includes(c) })),
    primaryKey: ["id"],
    foreignKeys: [],
  };
}

function header(tables: BackupTableSchema[]): BackupHeader {
  return {
    kind: "header",
    format: DB_TRANSFER_CONFIG.format,
    formatVersion: DB_TRANSFER_CONFIG.formatVersion,
    createdAt: new Date().toISOString(),
    source: { role: "legacy", label: "t", connection: "x", fingerprint: "x" },
    loadOrder: tables.map((t) => t.name),
    tables,
    cyclicFks: [],
  };
}

describe("diffSchema", () => {
  it("reports 'absent' when the target has none of the required tables", () => {
    const h = header([table("User", ["id"])]);
    expect(diffSchema(h, [], []).state).toBe("absent");
  });

  it("reports 'complete' when every required table is present", () => {
    const h = header([table("User", ["id"]), table("Post", ["id"])]);
    const target = [table("User", ["id"]), table("Post", ["id"])];
    const diff = diffSchema(h, target, ["User", "Post"]);
    expect(diff.state).toBe("complete");
    expect(diff.fatal).toEqual([]);
  });

  it("reports 'partial' when only some tables exist — the dangerous case", () => {
    const h = header([table("User", ["id"]), table("Post", ["id"])]);
    const diff = diffSchema(h, [table("User", ["id"])], ["User"]);
    expect(diff.state).toBe("partial");
    expect(diff.missing).toEqual(["Post"]);
    expect(diff.fatal.join()).toMatch(/partially applied/i);
  });

  it("treats a missing NOT NULL column as fatal", () => {
    const h = header([table("User", ["id", "email"])]);
    const diff = diffSchema(h, [table("User", ["id"])], ["User"]);
    expect(diff.state).toBe("complete");
    expect(diff.fatalColumnDrops).toEqual([{ table: "User", column: "email" }]);
    expect(diff.fatal.join()).toMatch(/incompatible columns/i);
  });

  it("tolerates a missing NULLABLE column and records it", () => {
    const h = header([table("User", ["id", "bio"], ["bio"])]);
    const diff = diffSchema(h, [table("User", ["id"])], ["User"]);
    expect(diff.nullableColumnDrops).toEqual([{ table: "User", column: "bio" }]);
    expect(diff.fatal).toEqual([]);
  });

  it("flags a newer NOT NULL target column with no default", () => {
    const h = header([table("User", ["id"])]);
    const target = [table("User", ["id", "requiredNew"])];
    const diff = diffSchema(h, target, ["User"]);
    expect(diff.fatalColumnDrops[0].column).toMatch(/requiredNew/);
  });

  it("accepts a newer target column that HAS a default", () => {
    const h = header([table("User", ["id"])]);
    const target: BackupTableSchema[] = [
      {
        name: "User",
        columns: [column("id"), column("withDefault", { isNullable: false, hasDefault: true })],
        primaryKey: ["id"],
        foreignKeys: [],
      },
    ];
    const diff = diffSchema(h, target, ["User"]);
    expect(diff.columnGains).toEqual([{ table: "User", column: "withDefault" }]);
    expect(diff.fatal).toEqual([]);
  });

  it("lists extra target tables without treating them as an error", () => {
    const h = header([table("User", ["id"])]);
    const diff = diffSchema(h, [table("User", ["id"]), table("Scratch", ["id"])], ["User", "Scratch"]);
    expect(diff.extra).toEqual(["Scratch"]);
    expect(diff.fatal).toEqual([]);
  });

  it("never counts Prisma bookkeeping as an extra table", () => {
    const h = header([table("User", ["id"])]);
    const diff = diffSchema(
      h,
      [table("User", ["id"]), table("_prisma_migrations", ["id"])],
      ["User", "_prisma_migrations"],
    );
    expect(diff.extra).toEqual([]);
  });
});

describe("describeSchemaDiff", () => {
  it("renders a short operator summary", () => {
    const h = header([table("User", ["id"]), table("Post", ["id"])]);
    const diff = diffSchema(h, [table("User", ["id"])], ["User"]);
    const lines = describeSchemaDiff(diff);

    expect(lines[0]).toMatch(/schema state: partial/);
    expect(lines.join("\n")).toMatch(/missing tables: Post/);
    expect(lines.join("\n")).toMatch(/blocked:/);
  });
});
