/**
 * Share-route validation hardening: strict fare parsing (ranges rejected),
 * every-step location required (no silent drop), sanitized messages.
 */
import {
  ROUTE_VALIDATION_CONFIG,
  parseFareInput,
  validateRouteComposer,
  sanitizeRouteErrorMessage,
  firstRouteServerMessage,
  fieldErrorClass,
} from "@/app/lib/config/routeValidation";

describe("parseFareInput", () => {
  it("accepts blank as no fare", () => {
    expect(parseFareInput("")).toEqual({ ok: true, value: undefined });
    expect(parseFareInput(undefined)).toEqual({ ok: true, value: undefined });
  });

  it("accepts a single amount", () => {
    expect(parseFareInput("450")).toEqual({ ok: true, value: 450 });
    expect(parseFareInput("₦1,200")).toEqual({ ok: true, value: 1200 });
  });

  it("rejects ranges like 400-500 with guidance (no silent 400)", () => {
    const r = parseFareInput("400-500");
    expect(r.ok).toBe(false);
    expect(r.error).toBe(ROUTE_VALIDATION_CONFIG.fareRangeHint);
  });

  it("rejects free text and negatives", () => {
    expect(parseFareInput("abc").ok).toBe(false);
    expect(parseFareInput("-50").ok).toBe(false);
  });
});

describe("validateRouteComposer", () => {
  const validSteps = [
    { location: "Marina", vehicle: "bus", fare: 300, fareRaw: "300" },
    { location: "Yaba", vehicle: "", fare: 0, fareRaw: "" },
  ];

  it("passes a complete route", () => {
    const v = validateRouteComposer({
      title: "Marina to Yaba via Obalende",
      description: "",
      steps: validSteps,
    });
    expect(v.valid).toBe(true);
  });

  it("flags an empty stop instead of silently dropping it", () => {
    const v = validateRouteComposer({
      title: "Marina to Yaba via Obalende",
      steps: [{ location: "Marina" }, { location: "   " }],
    });
    expect(v.valid).toBe(false);
    expect(v.steps[1]?.location).toBe(ROUTE_VALIDATION_CONFIG.locationRequired);
  });

  it("flags a fare range on its step", () => {
    const v = validateRouteComposer({
      title: "Marina to Yaba via Obalende",
      steps: [
        { location: "Marina", fareRaw: "400-500" },
        { location: "Yaba" },
      ],
    });
    expect(v.valid).toBe(false);
    expect(v.steps[0]?.fare).toBe(ROUTE_VALIDATION_CONFIG.fareRangeHint);
  });

  it("flags short titles and short descriptions", () => {
    const v = validateRouteComposer({
      title: "Hey",
      description: "short",
      steps: validSteps,
    });
    expect(v.valid).toBe(false);
    expect(v.title).toBe(ROUTE_VALIDATION_CONFIG.titleTooShort);
    expect(v.description).toBe(ROUTE_VALIDATION_CONFIG.descriptionTooShort);
  });
});

describe("sanitize + server message mapping", () => {
  it("redacts PII and strips markup", () => {
    const out = sanitizeRouteErrorMessage(
      "<b>Failed</b> for jane@example.com {\"a\":1}"
    );
    expect(out).not.toContain("<b>");
    expect(out).not.toContain("jane@example.com");
    expect(out).toContain("[redacted]");
  });

  it("prefers the first field message, sanitized", () => {
    const msg = firstRouteServerMessage(
      { fieldErrors: { routes: ["Enter a location for this stop."] }, formErrors: [] },
      "Validation failed"
    );
    expect(msg).toContain("location");
  });

  it("error boundaries use design tokens", () => {
    expect(fieldErrorClass(true)).toContain("border-error-border");
    expect(fieldErrorClass(false)).toContain("border-border");
  });
});
