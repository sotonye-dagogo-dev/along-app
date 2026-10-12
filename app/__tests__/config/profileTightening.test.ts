/**
 * Profile tightening: dead phone field removal, display-name whitespace
 * hygiene (config-driven), and edit-profile client validation caps.
 */
import {
  EDIT_PROFILE_FIELDS,
  PROFILE_VALIDATION_CONFIG,
  normalizePersonName,
  normalizeBio,
  normalizeProfilePatch,
  validateProfilePatch,
} from "@/app/lib/config";

describe("edit-profile form drops the unpersistable phone field", () => {
  it("has no phone field (no User column ever stored it)", () => {
    expect(EDIT_PROFILE_FIELDS.some((f) => f.name === "phone")).toBe(false);
  });

  it("keeps username first with names + bio", () => {
    const names = EDIT_PROFILE_FIELDS.map((f) => f.name);
    expect(names[0]).toBe("userName");
    expect(names).toEqual(
      expect.arrayContaining(["userName", "firstName", "lastName", "bio"]),
    );
  });

  it("carries client-side length caps mirroring the server", () => {
    const byName = new Map(EDIT_PROFILE_FIELDS.map((f) => [f.name, f]));
    expect(byName.get("firstName")?.validation).toMatchObject({
      minLength: 1,
      maxLength: 50,
    });
    expect(byName.get("lastName")?.validation).toMatchObject({
      minLength: 1,
      maxLength: 50,
    });
    expect(byName.get("bio")?.validation).toMatchObject({ maxLength: 160 });
  });
});

describe("normalizePersonName whitespace handling", () => {
  it("trims leading/trailing spaces", () => {
    expect(normalizePersonName("  Ada  ")).toBe("Ada");
  });

  it("collapses internal runs (spaces/tabs/newlines) to one space", () => {
    expect(normalizePersonName("Ada    Bello")).toBe("Ada Bello");
    expect(normalizePersonName("Ada\t\n Bello")).toBe("Ada Bello");
  });

  it("maps whitespace-only and non-strings to empty", () => {
    expect(normalizePersonName("   ")).toBe("");
    expect(normalizePersonName(undefined)).toBe("");
    expect(normalizePersonName(123)).toBe("");
  });

  it("registration parity: already-clean names pass through", () => {
    expect(normalizePersonName("Ada")).toBe("Ada");
  });
});

describe("normalizeBio", () => {
  it("trims ends but preserves internal newlines", () => {
    expect(normalizeBio("  line one\nline two  \n")).toBe("line one\nline two");
  });

  it("maps non-strings to empty", () => {
    expect(normalizeBio(undefined)).toBe("");
  });
});

describe("normalizeProfilePatch + validateProfilePatch", () => {
  it("ignores stale phone keys from older clients", () => {
    const patch = normalizeProfilePatch({
      firstName: "Ada",
      phone: "+234...",
    });
    expect(patch).toEqual({ firstName: "Ada" });
    expect(validateProfilePatch(patch)).toBeNull();
  });

  it("rejects whitespace-only names as empty", () => {
    expect(
      validateProfilePatch(normalizeProfilePatch({ firstName: "   " })),
    ).toBe(PROFILE_VALIDATION_CONFIG.firstNameRequired);
    expect(
      validateProfilePatch(normalizeProfilePatch({ lastName: "\t " })),
    ).toBe(PROFILE_VALIDATION_CONFIG.lastNameRequired);
  });

  it("rejects overlong names and bios", () => {
    expect(
      validateProfilePatch(normalizeProfilePatch({ firstName: "a".repeat(51) })),
    ).toBe(PROFILE_VALIDATION_CONFIG.firstNameTooLong);
    expect(
      validateProfilePatch(normalizeProfilePatch({ bio: "b".repeat(161) })),
    ).toBe(PROFILE_VALIDATION_CONFIG.bioTooLong);
  });

  it("accepts a fully normalized patch", () => {
    const patch = normalizeProfilePatch({
      firstName: "  Ada   ",
      lastName: "Bello ",
      bio: "  Explorer  ",
    });
    expect(patch).toEqual({ firstName: "Ada", lastName: "Bello", bio: "Explorer" });
    expect(validateProfilePatch(patch)).toBeNull();
  });

  it("empty patch (no display fields) is valid — PATCH falls back to no-fields check", () => {
    expect(validateProfilePatch(normalizeProfilePatch({}))).toBeNull();
  });
});
