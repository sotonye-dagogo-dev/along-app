/**
 * Location suggestions + Email Studio availability (directive 2026-10-13).
 *
 * - Rate limiter must isolate per-bucket counters so maps/geocode (location
 *   autocomplete) can never be starved by unrelated buckets (the silent-429
 *   regression that wiped suggestion dropdowns).
 * - geoBias exposes a sync peek + quick (budgeted) lookup so keystroke
 *   suggestions never stall on a cold GPS fix.
 * - Email Studio merge backfills new defaults under stored customs so a DB
 *   seeded with fewer templates still lists every template.
 */
import { checkRateLimit } from "@/app/lib/utils/rateLimit";
import { RATE_LIMITS } from "@/app/lib/config/rateLimits";
import {
  peekBiasCoords,
  getBiasCoordsQuick,
  biasQuerySuffix,
  rememberBiasCoords,
} from "@/app/lib/utils/geoBias";
import { mergeEmailTemplatesWithDefaults } from "@/app/lib/utils/emailTemplates";
import { DEFAULT_EMAIL_TEMPLATES } from "@/app/lib/config/email";

function req(): Request {
  return new Request("https://www.alongng.com/api/maps/geocode?q=lag", {
    headers: { "x-forwarded-for": `test-${Math.random().toString(36).slice(2)}` },
  });
}

describe("rateLimit per-bucket isolation (location suggestions)", () => {
  it("exposes a maps bucket used by the geocode proxy", () => {
    expect(RATE_LIMITS.maps.maxRequests).toBeGreaterThan(0);
  });
  it("does not let the search bucket consume the maps budget", () => {
    const r = req();
    // Exhaust the search bucket for this IP.
    for (let i = 0; i < RATE_LIMITS.search.maxRequests; i++) {
      checkRateLimit(r, "search");
    }
    expect(checkRateLimit(r, "search").allowed).toBe(false);
    // Maps on the SAME ip must still be allowed (per-bucket keys).
    expect(checkRateLimit(r, "maps").allowed).toBe(true);
  });
  it("still enforces the maps budget itself", () => {
    const r = req();
    for (let i = 0; i < RATE_LIMITS.maps.maxRequests; i++) {
      checkRateLimit(r, "maps");
    }
    expect(checkRateLimit(r, "maps").allowed).toBe(false);
  });
});

describe("geoBias quick path (non-blocking autocomplete)", () => {
  it("peek returns remembered coords without prompting", async () => {
    rememberBiasCoords({ lat: 6.5244, lng: 3.3792 });
    expect(peekBiasCoords()).toEqual({ lat: 6.5244, lng: 3.3792 });
    expect(biasQuerySuffix(peekBiasCoords())).toContain("&lat=6.5244");
    expect(biasQuerySuffix(null)).toBe("");
  });
  it("quick lookup resolves within budget on a cold cache", async () => {
    const t0 = Date.now();
    const res = await getBiasCoordsQuick(120);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(res === null || typeof res.lat === "number").toBe(true);
  });
});

describe("email studio merge (all templates visible)", () => {
  it("backfills defaults when stored has only one bug-report template", () => {
    const onlyOne = [DEFAULT_EMAIL_TEMPLATES.find((t) => t.name === "bugReportNotification")!];
    const merged = mergeEmailTemplatesWithDefaults(onlyOne);
    const names = merged.map((t) => t.name);
    for (const d of DEFAULT_EMAIL_TEMPLATES) {
      expect(names).toContain(d.name);
    }
    // Stored wins per-name (custom subject preserved).
    const custom = [{ ...onlyOne[0], subject: "Custom subject" }];
    expect(
      mergeEmailTemplatesWithDefaults(custom).find((t) => t.name === "bugReportNotification")!.subject,
    ).toBe("Custom subject");
  });
  it("defaults cover every wired sender (no studio-missing template)", () => {
    const names = DEFAULT_EMAIL_TEMPLATES.map((t) => t.name);
    for (const n of [
      "otp",
      "welcome",
      "verifyEmail",
      "bugReportReceived",
      "bugReportStatusUpdate",
      "accountDeletionRequested",
    ]) {
      expect(names).toContain(n);
    }
  });
});
