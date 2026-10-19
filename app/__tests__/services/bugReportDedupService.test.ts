/**
 * @jest-environment node
 *
 * Bug-report dedup core (Sprint 80 / issue #25):
 * - per-reporter advisory-lock keys (the single-writer serialisation that
 *   closed the duplicate-report race),
 * - matcher priority: idempotency key > error identity (path+digest, title
 *   NOT required) > exact description,
 * - candidate scan scoping (same reporter, dedup window, config cap),
 * - lock helpers never throw (best-effort serialisation).
 */
import type { Prisma } from "@/app/generated/prisma/client";
import {
  acquireBugReportDedupLock,
  buildDedupLockKey,
  dedupWindowStart,
  extractMetadataRecord,
  findDuplicateBugReport,
  matchesDuplicateBugReport,
  type IncomingBugReport,
} from "@/app/lib/services/bugReportDedupService";
import { BUG_REPORT_DEDUP_CONFIG } from "@/app/lib/config/reportAttachments";

const baseIncoming = (over: Partial<IncomingBugReport> = {}): IncomingBugReport => ({
  reporterId: "u1",
  description: "App crashes when opening the route map",
  idempotencyKey: null,
  clientPath: null,
  clientDigest: null,
  ...over,
});

describe("dedup lock key", () => {
  it("scopes per reporter with the configured prefix", () => {
    expect(buildDedupLockKey("user-1")).toBe(`${BUG_REPORT_DEDUP_CONFIG.dedupLockPrefix}user-1`);
  });
  it("buckets every anonymous reporter into one shared scope", () => {
    expect(buildDedupLockKey(null)).toBe(`${BUG_REPORT_DEDUP_CONFIG.dedupLockPrefix}anon`);
  });
});

describe("dedupWindowStart", () => {
  it("is now minus the configured window", () => {
    const now = 1_760_000_000_000;
    expect(dedupWindowStart(now).getTime()).toBe(
      now - BUG_REPORT_DEDUP_CONFIG.dedupWindowSec * 1000,
    );
  });
});

describe("extractMetadataRecord", () => {
  it("passes through objects and neutralises everything else", () => {
    expect(extractMetadataRecord({ a: 1 })).toEqual({ a: 1 });
    expect(extractMetadataRecord([1, 2])).toEqual({});
    expect(extractMetadataRecord(null)).toEqual({});
    expect(extractMetadataRecord(undefined)).toEqual({});
    expect(extractMetadataRecord("nope")).toEqual({});
  });
});

describe("matchesDuplicateBugReport", () => {
  it("matches on idempotency key alone (wording drift cannot defeat it)", () => {
    const row = {
      id: "b1",
      description: "totally different description",
      metadata: { idempotencyKey: "tok-1" },
    };
    expect(
      matchesDuplicateBugReport(row, baseIncoming({ idempotencyKey: "tok-1" })),
    ).toBe(true);
  });

  it("matches error identity on path+digest WITHOUT requiring a title match", () => {
    const row = {
      id: "b1",
      description: "old copy",
      metadata: { path: "/posts/[id]", digest: "d-9" },
    };
    expect(
      matchesDuplicateBugReport(
        row,
        baseIncoming({ clientPath: "/posts/[id]", clientDigest: "d-9" }),
      ),
    ).toBe(true);
  });

  it("matches identity when both sides carry a null digest (path carries it)", () => {
    const row = { id: "b1", description: "x", metadata: { path: "/home", digest: null } };
    expect(
      matchesDuplicateBugReport(row, baseIncoming({ clientPath: "/home", clientDigest: null })),
    ).toBe(true);
  });

  it("does not match identity when the digest disagrees", () => {
    const row = { id: "b1", description: "x", metadata: { path: "/home", digest: "A" } };
    expect(
      matchesDuplicateBugReport(row, baseIncoming({ clientPath: "/home", clientDigest: "B" })),
    ).toBe(false);
  });

  it("keeps the legacy exact-description match", () => {
    const row = { id: "b1", description: "same words", metadata: {} };
    expect(matchesDuplicateBugReport(row, baseIncoming({ description: "same words" }))).toBe(true);
  });

  it("never matches unrelated rows", () => {
    const row = { id: "b1", description: "other issue", metadata: { path: "/other" } };
    expect(
      matchesDuplicateBugReport(row, baseIncoming({ clientPath: "/home", clientDigest: "d" })),
    ).toBe(false);
  });

  it("tolerates unparseable legacy metadata (falls to content match only)", () => {
    const row = { id: "b1", description: "same words", metadata: "corrupt" };
    expect(matchesDuplicateBugReport(row, baseIncoming({ description: "same words" }))).toBe(true);
    expect(
      matchesDuplicateBugReport(
        row,
        baseIncoming({ description: "other", idempotencyKey: "tok" }),
      ),
    ).toBe(false);
  });
});

type MockTx = Prisma.TransactionClient & {
  $queryRaw: jest.Mock;
  bugReport: { findMany: jest.Mock };
};

function mockTx(): MockTx {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    bugReport: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as MockTx;
}

describe("findDuplicateBugReport", () => {
  it("scopes the scan to the reporter + window + config candidate cap", async () => {
    const tx = mockTx();
    const windowStart = dedupWindowStart();
    await findDuplicateBugReport(tx, baseIncoming({ reporterId: "u1" }), windowStart);
    expect(tx.bugReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { gte: windowStart }, reporterId: "u1" },
        orderBy: { createdAt: "desc" },
        take: BUG_REPORT_DEDUP_CONFIG.dedupMaxCandidates,
      }),
    );
  });

  it("scopes anonymous submissions to reporterId null (IS NULL)", async () => {
    const tx = mockTx();
    await findDuplicateBugReport(tx, baseIncoming({ reporterId: null }), dedupWindowStart());
    const arg = tx.bugReport.findMany.mock.calls[0][0];
    expect(arg.where.reporterId).toBeNull();
  });

  it("returns the first matcher hit, newest first", async () => {
    const tx = mockTx();
    tx.bugReport.findMany.mockResolvedValue([
      { id: "old", description: "nope", metadata: {} },
      { id: "new", description: "nope", metadata: { idempotencyKey: "tok" } },
    ]);
    const hit = await findDuplicateBugReport(
      tx,
      baseIncoming({ idempotencyKey: "tok" }),
      dedupWindowStart(),
    );
    expect(hit?.id).toBe("new");
  });

  it("returns null when nothing matches", async () => {
    const tx = mockTx();
    tx.bugReport.findMany.mockResolvedValue([
      { id: "a", description: "one", metadata: {} },
      { id: "b", description: "two", metadata: {} },
    ]);
    const hit = await findDuplicateBugReport(
      tx,
      baseIncoming({ description: "three" }),
      dedupWindowStart(),
    );
    expect(hit).toBeNull();
  });
});

describe("acquireBugReportDedupLock", () => {
  it("takes a tx-scoped advisory lock keyed by the reporter", async () => {
    const tx = mockTx();
    const ok = await acquireBugReportDedupLock(tx, "u1");
    expect(ok).toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("degrades to unlocked behaviour instead of throwing (never blocks reporting)", async () => {
    const tx = mockTx();
    tx.$queryRaw.mockRejectedValueOnce(new Error("lock unsupported"));
    await expect(acquireBugReportDedupLock(tx, "u1")).resolves.toBe(false);
  });
});
