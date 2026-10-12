/**
 * Profile-edit validation + normalization (config-driven, zero app deps).
 * Single source of truth for display-name whitespace handling so the edit
 * profile form, its client validation, and the PATCH endpoint all agree:
 * - leading/trailing whitespace is stripped (no "  Ada  " stored);
 * - internal runs of whitespace collapse to a single space (no "Ada    Bello");
 * - whitespace-only input counts as empty and is rejected with a sanitized
 *   field message instead of persisting invisible names;
 * - bio is trimmed (internal newlines preserved) and capped at 160 chars.
 *
 * Mirrors: REGISTER_SCHEMA (firstName/lastName max 50) + VALIDATION_RULES.bio.
 * Phone is intentionally absent — the User model has no phone column, the
 * register form never collected it, and the PATCH allowlist already dropped
 * it, so the edit-profile phone input could never persist.
 */

export interface ProfileValidationConfig {
  firstNameMin: number;
  firstNameMax: number;
  lastNameMin: number;
  lastNameMax: number;
  bioMax: number;
  /** Collapse internal `\s+` runs to a single space in person names. */
  collapseWhitespace: boolean;
  firstNameRequired: string;
  firstNameTooLong: string;
  lastNameRequired: string;
  lastNameTooLong: string;
  bioTooLong: string;
}

export const PROFILE_VALIDATION_CONFIG: ProfileValidationConfig = {
  firstNameMin: 1,
  firstNameMax: 50,
  lastNameMin: 1,
  lastNameMax: 50,
  bioMax: 160,
  collapseWhitespace: true,
  firstNameRequired: "First name is required.",
  firstNameTooLong: "First name must be 50 characters or fewer.",
  lastNameRequired: "Last name is required.",
  lastNameTooLong: "Last name must be 50 characters or fewer.",
  bioTooLong: "Bio must be 160 characters or fewer.",
};

/**
 * Normalize a person-name input: trim ends, collapse internal whitespace
 * runs (spaces, tabs, newlines) to a single space. Non-strings → "".
 */
export function normalizePersonName(
  value: unknown,
  config: ProfileValidationConfig = PROFILE_VALIDATION_CONFIG,
): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!config.collapseWhitespace) return trimmed;
  return trimmed.replace(/\s+/g, " ");
}

/**
 * Normalize a bio input: trim ends and strip trailing spaces per line,
 * preserving the author's internal newlines. Non-strings → "".
 */
export function normalizeBio(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/** Normalized subset of an edit-profile PATCH body. */
export interface NormalizedProfilePatch {
  firstName?: string;
  lastName?: string;
  bio?: string;
}

/**
 * Pick + normalize the display-name fields out of an unknown PATCH body.
 * Unknown/extra keys (e.g. a stale `phone` from older clients) are ignored
 * so legacy submissions keep working instead of failing.
 */
export function normalizeProfilePatch(
  body: Record<string, unknown>,
  config: ProfileValidationConfig = PROFILE_VALIDATION_CONFIG,
): NormalizedProfilePatch {
  const out: NormalizedProfilePatch = {};
  if (body.firstName !== undefined) {
    out.firstName = normalizePersonName(body.firstName, config);
  }
  if (body.lastName !== undefined) {
    out.lastName = normalizePersonName(body.lastName, config);
  }
  if (body.bio !== undefined) {
    out.bio = normalizeBio(body.bio);
  }
  return out;
}

/**
 * Validate a normalized patch. Returns the first field error message, or
 * null when valid. Operates on already-normalized values so whitespace-only
 * input ("   ") is caught as empty here and in the client alike.
 */
export function validateProfilePatch(
  patch: NormalizedProfilePatch,
  config: ProfileValidationConfig = PROFILE_VALIDATION_CONFIG,
): string | null {
  if (patch.firstName !== undefined) {
    if (patch.firstName.length < config.firstNameMin) return config.firstNameRequired;
    if (patch.firstName.length > config.firstNameMax) return config.firstNameTooLong;
  }
  if (patch.lastName !== undefined) {
    if (patch.lastName.length < config.lastNameMin) return config.lastNameRequired;
    if (patch.lastName.length > config.lastNameMax) return config.lastNameTooLong;
  }
  if (patch.bio !== undefined && patch.bio.length > config.bioMax) {
    return config.bioTooLong;
  }
  return null;
}
