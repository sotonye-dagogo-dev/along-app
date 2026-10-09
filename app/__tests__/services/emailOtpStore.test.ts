/**
 * @jest-environment node
 *
 * fix-build: durable EmailOtpToken store — OTP verification must survive
 * serverless instance hops (Redis/memory alone read as "expired" seconds
 * after issuance). Mirrors the resetTokenStore durability contract:
 * single-active rows, bcrypt-bound candidates, missing-table swallow.
 */
import {
  storeEmailOtpDb,
  verifyEmailOtpDb,
  consumeEmailOtpsDb,
  normalizeOtpEmail,
  EMAIL_OTP_PURPOSES,
} from "@/app/lib/services/emailOtpStore";
import { hashPassword } from "@/app/lib/utils/security";

jest.mock("@/app/lib/db/prisma", () => ({
  prisma: {
    emailOtpToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from "@/app/lib/db/prisma";

const mockStore = prisma.emailOtpToken as unknown as {
  deleteMany: jest.Mock;
  create: jest.Mock;
  findMany: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.deleteMany.mockResolvedValue({ count: 0 });
  mockStore.create.mockResolvedValue({ id: "row-1" });
  mockStore.findMany.mockResolvedValue([]);
});

describe("emailOtpStore: normalization", () => {
  it("lowercases/trims and rejects non-emails", () => {
    expect(normalizeOtpEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeOtpEmail("not-an-email")).toBeNull();
    expect(normalizeOtpEmail(undefined)).toBeNull();
  });

  it("exposes verify + change purposes", () => {
    expect(EMAIL_OTP_PURPOSES.verify).toBe("verify");
    expect(EMAIL_OTP_PURPOSES.change).toBe("change");
  });
});

describe("emailOtpStore: issuance is single-active", () => {
  it("replaces prior rows for the same email+purpose, then creates one row", async () => {
    const hash = await hashPassword("482937");
    await storeEmailOtpDb("ada@example.com", hash, "verify", 900);
    expect(mockStore.deleteMany).toHaveBeenCalled();
    expect(mockStore.create).toHaveBeenCalledTimes(1);
    const created = mockStore.create.mock.calls[0][0];
    expect(created.data.email).toBe("ada@example.com");
    expect(created.data.purpose).toBe("verify");
    expect(created.data.otpHash).toBe(hash);
    expect(new Date(created.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("binds change-email rows to the requesting user", async () => {
    const hash = await hashPassword("new@example.com::482937");
    await storeEmailOtpDb("new@example.com", hash, "change", 900, "user-1");
    const created = mockStore.create.mock.calls[0][0];
    expect(created.data.userId).toBe("user-1");
    expect(created.data.email).toBe("new@example.com");
  });

  it("no-ops on empty email/hash instead of writing junk rows", async () => {
    await storeEmailOtpDb("", "hash", "verify", 900);
    await storeEmailOtpDb("a@b.co", "", "verify", 900);
    expect(mockStore.create).not.toHaveBeenCalled();
  });
});

describe("emailOtpStore: verification", () => {
  it("accepts the live code via bcrypt", async () => {
    const hash = await hashPassword("482937");
    mockStore.findMany.mockResolvedValue([
      { email: "ada@example.com", purpose: "verify", userId: null, otpHash: hash, expiresAt: new Date(Date.now() + 600_000) },
    ]);
    await expect(verifyEmailOtpDb("ADA@example.com", "482937", "verify")).resolves.toBe(true);
  });

  it("rejects a wrong code without consuming the row", async () => {
    const hash = await hashPassword("482937");
    mockStore.findMany.mockResolvedValue([
      { email: "ada@example.com", purpose: "verify", userId: null, otpHash: hash, expiresAt: new Date(Date.now() + 600_000) },
    ]);
    await expect(verifyEmailOtpDb("ada@example.com", "000000", "verify")).resolves.toBe(false);
    expect(mockStore.deleteMany).not.toHaveBeenCalled();
  });

  it("treats expired rows as missing (and prunes them)", async () => {
    const hash = await hashPassword("482937");
    mockStore.findMany.mockResolvedValue([
      { email: "ada@example.com", purpose: "verify", userId: null, otpHash: hash, expiresAt: new Date(Date.now() - 1000) },
    ]);
    await expect(verifyEmailOtpDb("ada@example.com", "482937", "verify")).resolves.toBe(false);
    expect(mockStore.deleteMany).toHaveBeenCalled();
  });

  it("returns false when no row exists (never issued) — callers map to the expired copy", async () => {
    await expect(verifyEmailOtpDb("nobody@example.com", "482937", "verify")).resolves.toBe(false);
  });

  it("change-email binds candidate `newEmail::otp` to the user row", async () => {
    const hash = await hashPassword("new@example.com::482937");
    mockStore.findMany.mockResolvedValue([
      { email: "new@example.com", purpose: "change", userId: "user-1", otpHash: hash, expiresAt: new Date(Date.now() + 600_000) },
    ]);
    await expect(
      verifyEmailOtpDb("new@example.com", "482937", "change", {
        userId: "user-1",
        candidate: "new@example.com::482937",
      })
    ).resolves.toBe(true);
    // Another user's row for a different address must not verify here.
    mockStore.findMany.mockResolvedValue([
      { email: "other@example.com", purpose: "change", userId: "user-1", otpHash: hash, expiresAt: new Date(Date.now() + 600_000) },
    ]);
    await expect(
      verifyEmailOtpDb("new@example.com", "482937", "change", {
        userId: "user-1",
        candidate: "new@example.com::482937",
      })
    ).resolves.toBe(false);
  });
});

describe("emailOtpStore: consume + missing-table safety", () => {
  it("consume deletes the email+purpose scope", async () => {
    await consumeEmailOtpsDb("ada@example.com", "verify");
    expect(mockStore.deleteMany).toHaveBeenCalledWith({
      where: { email: "ada@example.com", purpose: "verify" },
    });
  });

  it("swallows a pending-migration (P2021) instead of failing auth", async () => {
    const missing = Object.assign(new Error('relation "EmailOtpToken" does not exist'), {
      code: "P2021",
      name: "PrismaClientKnownRequestError",
    });
    mockStore.findMany.mockRejectedValue(missing);
    await expect(verifyEmailOtpDb("a@b.co", "123456", "verify")).resolves.toBe(false);
    mockStore.create.mockRejectedValue(missing);
    await expect(storeEmailOtpDb("a@b.co", "hash", "verify", 900)).resolves.toBeUndefined();
    mockStore.deleteMany.mockRejectedValue(missing);
    await expect(consumeEmailOtpsDb("a@b.co", "verify")).resolves.toBeUndefined();
  });
});
