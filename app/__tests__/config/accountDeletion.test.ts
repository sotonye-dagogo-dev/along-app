import {
  ACCOUNT_DELETION_CONFIG,
  deletionScheduledFor,
  buildDeletedUserName,
  buildDeletedEmail,
  isDeletionOverdue,
} from "@/app/lib/config/accountDeletion";
import {
  EMAIL_MANAGEMENT_CONFIG,
  isSystemTemplate,
  parseManualEmails,
} from "@/app/lib/config/emailManagement";
import { ADMIN_BULK_SELECT_META } from "@/app/lib/config/admin";
import { DEFAULT_EMAIL_TEMPLATES } from "@/app/lib/config/email";

describe("account deletion lifecycle config", () => {
  it("uses a 7-day grace period and 30-day retention", () => {
    expect(ACCOUNT_DELETION_CONFIG.gracePeriodDays).toBe(7);
    expect(ACCOUNT_DELETION_CONFIG.retentionDays).toBe(30);
  });

  it("schedules finalization grace-period days out", () => {
    const from = new Date("2026-10-09T00:00:00Z");
    const due = deletionScheduledFor(from);
    expect(due.getTime() - from.getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it("builds stable anonymized identities", () => {
    expect(buildDeletedUserName("abcdefgh1234")).toBe("deleted_user_abcdefgh");
    expect(buildDeletedEmail("abcdefgh1234")).toBe("deleted_abcdefgh@deleted.local");
  });

  it("detects overdue scheduled dates", () => {
    expect(isDeletionOverdue(new Date(Date.now() - 1000))).toBe(true);
    expect(isDeletionOverdue(new Date(Date.now() + 100000))).toBe(false);
  });
});

describe("email management config (crellab mirror)", () => {
  it("ships deletion templates as system templates", () => {
    const names = DEFAULT_EMAIL_TEMPLATES.map((t) => t.name);
    expect(names).toContain("accountDeletionRequested");
    expect(names).toContain("accountDeletionCompleted");
    expect(names).toContain("adminDeletionAlert");
    expect(isSystemTemplate("accountDeletionRequested")).toBe(true);
    expect(isSystemTemplate("myCustomDigest")).toBe(false);
  });

  it("offers dynamic recipient modes with caps", () => {
    const modes = EMAIL_MANAGEMENT_CONFIG.recipientModes.map((m) => m.id);
    expect(modes).toEqual(expect.arrayContaining(["admins", "all", "role", "firstN", "search", "manual"]));
    expect(EMAIL_MANAGEMENT_CONFIG.maxRecipientsPerSend).toBeGreaterThan(0);
  });

  it("parses manual email lists safely", () => {
    expect(parseManualEmails("a@x.com, B@x.com\nbad\n a@x.com")).toEqual(["a@x.com", "b@x.com"]);
  });
});

describe("admin bulk selection = first-N signups", () => {
  it("documents signup-order semantics and includes First 100", () => {
    expect(ADMIN_BULK_SELECT_META.firstNBySignupOrder).toBe(true);
    expect(ADMIN_BULK_SELECT_META.quickPresets.map((p) => p.count)).toContain(100);
  });
});
