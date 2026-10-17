/**
 * Registry + journal-semantics tests.
 *
 * The resume rule is the headline feature: "if a COMPLETE, uncorrupted,
 * extremely-recent, NOT-YET-USED backup exists, continue instead of
 * re-dumping." Each of those four adjectives is a separate predicate, and
 * this file pins every one of them.
 */

import {
  DB_STAGES,
  DB_TRANSFER_CONFIG,
  backupFileName,
  backupId,
  describeConnection,
  evaluateResume,
  fileSafeTimestamp,
  fingerprintConnection,
  isPlanComplete,
  nextStage,
  redactConnectionString,
  type DbStagePlan,
  type DbTransferJournalEntry,
} from "@/app/lib/config/dbTransfer";
import { normalizePgUrl, resolveRoleUrl } from "@/scripts/lib/dbTransfer/url";

const NOW = new Date("2026-10-17T12:00:00.000Z");

function entry(overrides: Partial<DbTransferJournalEntry> = {}): DbTransferJournalEntry {
  return {
    id: "legacy-to-supabase-2026-10-17T11-00-00-000Z",
    direction: { source: "legacy", target: "supabase" },
    file: "backups/db-transfer/legacy-to-supabase-2026-10-17T11-00-00-000Z.jsonl",
    createdAt: "2026-10-17T11:00:00.000Z",
    updatedAt: "2026-10-17T11:00:00.000Z",
    stages: { "backup-created": { at: "2026-10-17T11:00:00.000Z" } },
    ...overrides,
  };
}

const DIRECTION = { source: "legacy", target: "supabase" } as const;

describe("DB_TRANSFER_CONFIG shape", () => {
  it("declares every stage in dependency order", () => {
    expect(DB_STAGES).toEqual([
      "backup-created",
      "target-inspected",
      "target-safety-backup",
      "schema-ready",
      "loaded",
      "verified",
      "consumed",
    ]);
  });

  it("orders every plan consistently with DB_STAGES", () => {
    const plans: DbStagePlan[] = Object.values(DB_TRANSFER_CONFIG.plans);
    for (const plan of plans) {
      const indices = plan.map((stage) => DB_STAGES.indexOf(stage));
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
      expect(new Set(plan).size).toBe(plan.length);
      // Anything that writes to a target must prove it worked before it is
      // allowed to consume the backup.
      if (plan.includes("loaded")) {
        expect(plan).toContain("verified");
        expect(plan).toContain("consumed");
      }
    }
  });

  it("lists the Prisma Accelerate URL as a NON-primary candidate for the legacy role", () => {
    // The accelerate URL cannot be opened by `pg`, so it must never be the
    // first thing a script reaches for.
    const candidates = DB_TRANSFER_CONFIG.roles.legacy.envUrlCandidates;
    expect(candidates).toContain("PREVIOUS_DIRECT_URL");
    expect(candidates.indexOf("PREVIOUS_DIRECT_URL")).toBeLessThan(
      candidates.indexOf("PREVIOUS_DATABASE_URL"),
    );
  });

  it("prefers the session-mode Supabase URL over the transaction pooler", () => {
    const candidates = DB_TRANSFER_CONFIG.roles.supabase.envUrlCandidates;
    expect(candidates.indexOf("DIRECT_URL")).toBeLessThan(candidates.indexOf("DATABASE_URL"));
  });

  it("names the dev aliases that can silently target the wrong database", () => {
    expect(DB_TRANSFER_CONFIG.devAliasEnvVars).toEqual(["DIRECT_LOCAL_DB", "LOCAL_DB"]);
  });

  it("excludes Prisma's migration bookkeeping from restores", () => {
    expect(DB_TRANSFER_CONFIG.bookkeepingTables).toContain("_prisma_migrations");
  });
});

describe("file naming", () => {
  it("produces a filesystem-safe, sortable timestamp", () => {
    expect(fileSafeTimestamp(new Date("2026-10-17T10:15:00.123Z"))).toBe(
      "2026-10-17T10-15-00-123Z",
    );
  });

  it("names files by direction so they are self-describing", () => {
    const name = backupFileName({
      source: "legacy",
      target: "supabase",
      at: "2026-10-17T10:15:00.123Z",
    });
    expect(name).toBe("legacy-to-supabase-2026-10-17T10-15-00-123Z.jsonl");
  });

  it("supports the local pseudo-target for safety snapshots", () => {
    expect(backupFileName({ source: "supabase", target: "local", at: "2026-01-01T00:00:00.000Z" }))
      .toBe("supabase-to-local-2026-01-01T00-00-00-000Z.jsonl");
  });

  it("derives the journal id from the file name", () => {
    expect(backupId("legacy-to-supabase-2026-10-17T10-15-00-123Z.jsonl")).toBe(
      "legacy-to-supabase-2026-10-17T10-15-00-123Z",
    );
  });
});

describe("redaction / fingerprints", () => {
  it("strips credentials before anything can be logged", () => {
    const redacted = redactConnectionString("postgresql://alice:s3cret@db.example.com:5432/along");
    expect(redacted).not.toContain("s3cret");
    expect(redacted).not.toContain("alice");
    expect(redacted).toContain("db.example.com");
  });

  it("redacts a password-less user too", () => {
    expect(redactConnectionString("postgresql://alice@db.example.com/along")).not.toContain("alice");
  });

  it("reports <unset> for an empty value", () => {
    expect(redactConnectionString("")).toBe("<unset>");
  });

  it("never throws on a malformed string", () => {
    expect(() => redactConnectionString("not a url")).not.toThrow();
  });

  it("fingerprints a URL down to host + database with no secrets", () => {
    const fp = fingerprintConnection("postgresql://user:pass@db.example.com:5432/along?sslmode=require");
    expect(fp).toEqual({
      scheme: "postgresql",
      host: "db.example.com",
      port: "5432",
      database: "along",
    });
  });

  it("defaults the port for postgres URLs", () => {
    expect(fingerprintConnection("postgresql://h/db")?.port).toBe("5432");
  });

  it("returns null rather than throwing for junk", () => {
    expect(fingerprintConnection("nonsense")).toBeNull();
  });

  it("describes a connection in one secret-free line", () => {
    const described = describeConnection("postgresql://u:p@host.example:6543/postgres?pgbouncer=true");
    expect(described).toBe("postgresql://host.example:6543/postgres");
    expect(described).not.toContain("p@");
  });
});

describe("stage bookkeeping", () => {
  it("advances to the first unrecorded stage", () => {
    const e = entry({
      stages: {
        "backup-created": { at: NOW.toISOString() },
        "target-inspected": { at: NOW.toISOString() },
      },
    });
    expect(nextStage(DB_TRANSFER_CONFIG.plans.migrate, e)).toBe("target-safety-backup");
  });

  it("starts at the first stage when there is no entry", () => {
    expect(nextStage(DB_TRANSFER_CONFIG.plans.migrate, null)).toBe("backup-created");
  });

  it("returns null once every stage is complete", () => {
    const complete = Object.fromEntries(DB_STAGES.map((s) => [s, { at: NOW.toISOString() }]));
    const e = entry({ stages: complete });
    expect(nextStage(DB_TRANSFER_CONFIG.plans.migrate, e)).toBeNull();
    expect(isPlanComplete(DB_TRANSFER_CONFIG.plans.migrate, e)).toBe(true);
  });
});

describe("evaluateResume — the four adjectives", () => {
  const plan = DB_TRANSFER_CONFIG.plans.migrate;

  it("RESUMES a complete-but-unused, fresh, matching backup", () => {
    const decision = evaluateResume({
      entry: entry({ updatedAt: new Date(NOW.getTime() - 10 * 60_000).toISOString() }),
      direction: DIRECTION,
      plan,
      now: NOW,
    });
    expect(decision.resumable).toBe(true);
    expect(decision.stage).toBe("target-inspected");
    expect(decision.ageMinutes).toBeCloseTo(10, 3);
  });

  it("REFUSES when there is no prior run at all", () => {
    const decision = evaluateResume({ entry: null, direction: DIRECTION, plan, now: NOW });
    expect(decision.resumable).toBe(false);
    expect(decision.reason).toMatch(/no prior run/i);
  });

  it("REFUSES a backup that was already consumed (the 'used' signal)", () => {
    const decision = evaluateResume({
      entry: entry({
        updatedAt: NOW.toISOString(),
        stages: {
          "backup-created": { at: NOW.toISOString() },
          consumed: { at: NOW.toISOString() },
        },
      }),
      direction: DIRECTION,
      plan,
      now: NOW,
    });
    expect(decision.resumable).toBe(false);
    expect(decision.reason).toMatch(/already consumed/i);
  });

  it("REFUSES a backup that is older than the freshness window", () => {
    const stale = new Date(NOW.getTime() - (DB_TRANSFER_CONFIG.resume.freshnessMinutes + 1) * 60_000);
    const decision = evaluateResume({
      entry: entry({ updatedAt: stale.toISOString() }),
      direction: DIRECTION,
      plan,
      now: NOW,
    });
    expect(decision.resumable).toBe(false);
    expect(decision.reason).toMatch(/freshness window/i);
  });

  it("ACCEPTS a backup exactly at the edge of the freshness window", () => {
    const edge = new Date(NOW.getTime() - DB_TRANSFER_CONFIG.resume.freshnessMinutes * 60_000);
    expect(
      evaluateResume({ entry: entry({ updatedAt: edge.toISOString() }), direction: DIRECTION, plan, now: NOW })
        .resumable,
    ).toBe(true);
  });

  it("REFUSES a backup from a different direction (never cross the streams)", () => {
    const decision = evaluateResume({
      entry: entry({ direction: { source: "supabase", target: "legacy" }, updatedAt: NOW.toISOString() }),
      direction: DIRECTION,
      plan,
      now: NOW,
    });
    expect(decision.resumable).toBe(false);
    expect(decision.reason).toMatch(/different direction/i);
  });

  it("REFUSES an entry with no dump file recorded", () => {
    const decision = evaluateResume({
      entry: entry({ file: "", updatedAt: NOW.toISOString() }),
      direction: DIRECTION,
      plan,
      now: NOW,
    });
    expect(decision.resumable).toBe(false);
    expect(decision.reason).toMatch(/no dump file/i);
  });

  it("REFUSES an entry whose run already finished", () => {
    // Uses the local-only `backup` plan (which has no `consumed` stage) so
    // the completeness guard is exercised rather than the consumed guard.
    const backupPlan = DB_TRANSFER_CONFIG.plans.backup;
    const decision = evaluateResume({
      entry: entry({
        direction: { source: "legacy", target: "local" },
        stages: { "backup-created": { at: NOW.toISOString() } },
        updatedAt: NOW.toISOString(),
      }),
      direction: { source: "legacy", target: "local" },
      plan: backupPlan,
      now: NOW,
    });
    expect(decision.resumable).toBe(false);
    expect(decision.reason).toMatch(/already complete/i);
  });

  it("REFUSES a finished multi-stage run via the consumed guard", () => {
    const complete = Object.fromEntries(DB_STAGES.map((s) => [s, { at: NOW.toISOString() }]));
    const decision = evaluateResume({
      entry: entry({ stages: complete, updatedAt: NOW.toISOString() }),
      direction: DIRECTION,
      plan,
      now: NOW,
    });
    expect(decision.resumable).toBe(false);
    expect(decision.reason).toMatch(/already consumed/i);
  });

  it("honours an explicit freshness override", () => {
    const updatedAt = new Date(NOW.getTime() - 30 * 60_000);
    const e = entry({ updatedAt: updatedAt.toISOString() });

    expect(
      evaluateResume({ entry: e, direction: DIRECTION, plan, now: NOW, freshnessMinutes: 60 }).resumable,
    ).toBe(true);
    expect(
      evaluateResume({ entry: e, direction: DIRECTION, plan, now: NOW, freshnessMinutes: 10 }).resumable,
    ).toBe(false);
  });

  it("treats a non-parsable timestamp as infinitely stale rather than resumable", () => {
    const decision = evaluateResume({
      entry: entry({ updatedAt: "not-a-date" }),
      direction: DIRECTION,
      plan,
      now: NOW,
    });
    expect(decision.resumable).toBe(false);
    expect(decision.ageMinutes).toBe(Number.POSITIVE_INFINITY);
  });
});

/* ------------------------------------------------------------------ *
 * TLS normalisation
 *
 * Guarded because it is the one place where guessing wrong fails the run
 * at connect time. Supabase's pooler sends a self-signed root inside its
 * chain, so `sslmode=require` fails there with "self-signed certificate
 * in certificate chain" — only `no-verify` both encrypts and connects.
 * ------------------------------------------------------------------ */

describe("normalizePgUrl — TLS selection", () => {
  const SUPA = "postgresql://user:pass@aws-1-eu-west-2.pooler.supabase.com:5432/postgres";

  function normalize(role: "supabase" | "legacy", url: string) {
    return normalizePgUrl({ url, fromVar: "TEST", role });
  }

  it("REGRESSION GUARD: uses no-verify for Supabase, never require", () => {
    const { url, notes } = normalize("supabase", SUPA);

    expect(url).toContain("sslmode=no-verify");
    expect(url).not.toContain("sslmode=require");
    expect(notes.join("\n")).toMatch(/self-signed root/i);
  });

  it("leaves an explicit sslmode alone", () => {
    for (const mode of ["disable", "require", "no-verify", "verify-full"]) {
      const { url } = normalize("supabase", `${SUPA}?sslmode=${mode}`);
      expect(url).toContain(`sslmode=${mode}`);
      expect(url.match(/sslmode=/g)).toHaveLength(1);
    }
  });

  it("keeps VERIFIED TLS for Prisma hosts, whose chain does validate", () => {
    const { url, notes } = normalize("legacy", "postgres://user:pass@db.prisma.io:5432/postgres");

    expect(url).toContain("sslmode=require");
    expect(url).not.toContain("no-verify");
    expect(notes.join("\n")).toMatch(/public root/i);
  });

  it("warns loudly when someone forces plaintext on a TLS host", () => {
    const { notes } = normalize("supabase", `${SUPA}?sslmode=disable`);
    expect(notes.join("\n")).toMatch(/WARNING: sslmode=disable/);
  });

  it("appends rather than clobbering other query params", () => {
    const { url } = normalize("supabase", `${SUPA}?pgbouncer=true`);
    expect(url).toContain("pgbouncer=true");
    expect(url).toContain("sslmode=no-verify");
  });

  it("notes that a transaction pooler is the wrong port for bulk loads", () => {
    const { notes } = normalize(
      "supabase",
      "postgresql://u:p@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=no-verify&pgbouncer=true",
    );
    expect(notes.join("\n")).toMatch(/transaction-mode/);
  });

  it("does nothing to a host with no TLS rule", () => {
    const { url, notes } = normalize("legacy", "postgres://user:pass@localhost:5432/along");
    expect(url).toBe("postgres://user:pass@localhost:5432/along");
    expect(notes).toEqual([]);
  });

  it("rejects a Prisma Accelerate URL with an actionable remedy", () => {
    const attempt = () =>
      normalize("legacy", "prisma+postgres://accelerate.prisma-data.net/?pgbouncer=true");

    expect(attempt).toThrow(/not usable/i);
    try {
      attempt();
    } catch (error) {
      expect((error as { remedy: string }).remedy).toMatch(/PREVIOUS_DIRECT_URL/);
    }
  });
});

describe("resolveRoleUrl — candidate ordering against a real .env shape", () => {
  it("never returns an Accelerate URL for the legacy role when a direct one exists", () => {
    const resolved = resolveRoleUrl("legacy", {
      env: {
        DIRECT_LOCAL_DB: "postgres://db.prisma.io:5432/postgres",
        LOCAL_DB: "prisma+postgres://accelerate.prisma-data.net:/",
      },
    });
    expect(resolved.fromVar).toBe("DIRECT_LOCAL_DB");
    expect(resolved.url).not.toMatch(/^prisma\+/);
  });

  it("prefers the Supabase session-mode URL over the app's DATABASE_URL", () => {
    const resolved = resolveRoleUrl("supabase", {
      env: {
        DIRECT_URL: "postgresql://aws-1-eu-west-2.pooler.supabase.com:5432/postgres",
        DATABASE_URL: "postgresql://aws-1-eu-west-2.pooler.supabase.com:6543/postgres",
      },
    });
    expect(resolved.fromVar).toBe("DIRECT_URL");
  });

  it("honours an explicit DB_BACKUP_* override above everything", () => {
    const resolved = resolveRoleUrl("legacy", {
      env: {
        DB_BACKUP_LEGACY_URL: "postgres://override.example:5432/along",
        PREVIOUS_DIRECT_URL: "postgres://ignored.example:5432/along",
      },
    });
    expect(resolved.fromVar).toBe("DB_BACKUP_LEGACY_URL");
  });

  it("reports every candidate when nothing is configured", () => {
    try {
      resolveRoleUrl("supabase", { env: {} });
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as { remedy: string }).remedy).toMatch(/Set one of/);
    }
  });
});
