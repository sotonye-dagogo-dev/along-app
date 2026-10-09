/**
 * Route-composer validation (config-driven, zero app deps).
 * Single source of truth for share-route form validation so the composer,
 * Zod schemas, and server friendly-messages all agree:
 * - every visible step needs a location (no silent drop of empty stops);
 * - fares are single non-negative amounts — ranges like "400-500" are
 *   rejected with guidance instead of silently coercing via parseFloat;
 * - all user-facing copy is sanitized (PII redacted, capped, never raw
 *   JSON/HTML) and error boundaries use design tokens.
 */

export interface RouteValidationConfig {
  titleMin: number;
  titleMax: number;
  titleRequired: string;
  titleTooShort: string;
  titleTooLong: string;
  descriptionMin: number;
  descriptionMax: number;
  descriptionTooShort: string;
  stepsMin: number;
  stepsTooFew: string;
  locationRequired: string;
  locationTooLong: string;
  locationMax: number;
  fareInvalid: string;
  fareRangeHint: string;
  fareNegative: string;
  fareTooLarge: string;
  fareMax: number;
  vehicleInvalid: string;
  formInvalid: string;
  submitBlocked: string;
  /** Max length for any sanitized message shown to users. */
  maxMessageLength: number;
}

export const ROUTE_VALIDATION_CONFIG: RouteValidationConfig = {
  titleMin: 5,
  titleMax: 100,
  titleRequired: "Give your route a title.",
  titleTooShort: "Title must be at least 5 characters.",
  titleTooLong: "Title must be 100 characters or fewer.",
  descriptionMin: 10,
  descriptionMax: 500,
  descriptionTooShort:
    "Description needs at least 10 characters — or leave it empty.",
  stepsMin: 2,
  stepsTooFew: "Add at least 2 route steps with a location each.",
  locationRequired: "Enter a location for this stop.",
  locationTooLong: "Location must be 200 characters or fewer.",
  locationMax: 200,
  fareInvalid: "Enter a single fare amount in naira (numbers only).",
  fareRangeHint:
    'Ranges like "400-500" aren\u2019t supported — enter one amount per leg (e.g. 450).',
  fareNegative: "Fare can\u2019t be negative.",
  fareTooLarge: "Fare looks too large — please check the amount.",
  fareMax: 10_000_000,
  vehicleInvalid: "Choose a vehicle from the list, or leave it empty.",
  formInvalid: "Please fix the highlighted fields before sharing.",
  submitBlocked: "This route isn\u2019t ready to share yet.",
  maxMessageLength: 200,
};

export interface FareParseResult {
  ok: boolean;
  /** Numeric value when ok (undefined when the input was blank = no fare). */
  value?: number;
  /** Config-driven user message when !ok. */
  error?: string;
}

/**
 * Strict fare parser. Blank => no fare (ok). Otherwise the whole trimmed
 * input must be a single non-negative finite number — ranges ("400-500",
 * "400 to 500"), currency symbols, commas-as-thousands ("1,200" accepted via
 * normalization), and negatives are classified into specific messages.
 */
export function parseFareInput(raw: unknown): FareParseResult {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  const text = String(raw).trim();
  if (text.length === 0) return { ok: true, value: undefined };
  // Range detection before numeric coercion (parseFloat would silently take
  // the leading "400" from "400-500" — the exact bug reported).
  if (/[-–—]/.test(text) && /\d.*[-–—].*\d/.test(text)) {
    return { ok: false, error: ROUTE_VALIDATION_CONFIG.fareRangeHint };
  }
  if (/\bto\b/i.test(text) && /\d/.test(text)) {
    return { ok: false, error: ROUTE_VALIDATION_CONFIG.fareRangeHint };
  }
  // Allow "₦", commas, and spaces around a single number.
  const normalized = text.replace(/[₦,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { ok: false, error: ROUTE_VALIDATION_CONFIG.fareInvalid };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { ok: false, error: ROUTE_VALIDATION_CONFIG.fareInvalid };
  }
  if (value < 0) {
    return { ok: false, error: ROUTE_VALIDATION_CONFIG.fareNegative };
  }
  if (value > ROUTE_VALIDATION_CONFIG.fareMax) {
    return { ok: false, error: ROUTE_VALIDATION_CONFIG.fareTooLarge };
  }
  return { ok: true, value };
}

export interface ComposerStepLike {
  location?: string;
  description?: string;
  vehicle?: string;
  fare?: number;
  /** Raw fare text as typed (when present, validated strictly). */
  fareRaw?: string;
}

export interface StepFieldErrors {
  location?: string;
  fare?: string;
  vehicle?: string;
}

export interface ComposerValidation {
  valid: boolean;
  title?: string;
  description?: string;
  steps: StepFieldErrors[];
  /** First error in display order (for toast + focus). */
  firstError?: string;
}

/** Allowed vehicle keys mirror VEHICLE_REGISTRY (zero-dep copy to avoid import cycles). */
const KNOWN_VEHICLES = new Set([
  "taxi",
  "bike",
  "keke",
  "bus",
  "trekking",
  "car",
  "bolt",
]);

/**
 * Validates a share-route composer snapshot. Every step in `steps` is
 * validated (no silent filtering) so an empty stop blocks submit with an
 * inline error instead of vanishing and confusing the poster.
 */
export function validateRouteComposer(input: {
  title: string;
  description?: string;
  steps: ComposerStepLike[];
}): ComposerValidation {
  const cfg = ROUTE_VALIDATION_CONFIG;
  const steps: StepFieldErrors[] = input.steps.map(() => ({}));
  let title: string | undefined;
  let description: string | undefined;

  const t = (input.title ?? "").trim();
  if (t.length === 0) title = cfg.titleRequired;
  else if (t.length < cfg.titleMin) title = cfg.titleTooShort;
  else if (t.length > cfg.titleMax) title = cfg.titleTooLong;

  const d = (input.description ?? "").trim();
  if (d.length > 0) {
    if (d.length < cfg.descriptionMin) description = cfg.descriptionTooShort;
    else if (d.length > cfg.descriptionMax)
      description = `Description must be ${cfg.descriptionMax} characters or fewer.`;
  }

  input.steps.forEach((s, i) => {
    const loc = (s.location ?? "").trim();
    if (loc.length === 0) steps[i].location = cfg.locationRequired;
    else if (loc.length > cfg.locationMax) steps[i].location = cfg.locationTooLong;
    const raw = s.fareRaw !== undefined ? s.fareRaw : s.fare !== undefined ? String(s.fare) : "";
    // Destination fare is hidden/stripped elsewhere; validate only when the
    // composer actually carries a fare value for this step.
    if (String(raw).trim().length > 0) {
      const parsed = parseFareInput(raw);
      if (!parsed.ok && parsed.error) steps[i].fare = parsed.error;
      else if (s.fare !== undefined && !(s.fare >= 0 && Number.isFinite(s.fare))) {
        steps[i].fare = cfg.fareInvalid;
      }
    } else if (typeof s.fare === "number" && !(s.fare >= 0 && Number.isFinite(s.fare))) {
      steps[i].fare = cfg.fareInvalid;
    }
    const v = (s.vehicle ?? "").trim();
    if (v && !KNOWN_VEHICLES.has(v)) steps[i].vehicle = cfg.vehicleInvalid;
  });

  const locatedCount = input.steps.filter(
    (s) => (s.location ?? "").trim().length > 0
  ).length;
  const stepsValid =
    input.steps.length >= cfg.stepsMin && locatedCount >= cfg.stepsMin;
  const stepsClean = steps.every(
    (e) => !e.location && !e.fare && !e.vehicle
  );
  const valid = !title && !description && stepsClean && stepsValid;
  const firstError =
    title ??
    description ??
    steps.flatMap((e) => [e.location, e.fare, e.vehicle]).find(Boolean) ??
    (!stepsValid ? cfg.stepsTooFew : undefined);
  return { valid, ...(title ? { title } : {}), ...(description ? { description } : {}), steps, ...(firstError ? { firstError } : {}) };
}

/** Patterns scrubbed from server/validation text before display (PII-safe). */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.]+/g,
  /bearer\s+[A-Za-z0-9\-._~+/=]+/gi,
  /(password|otp|token|secret|api[-_]?key)\s*[:=]\s*\S+/gi,
];

/**
 * Sanitizes any error text for user display: stringifies safely, strips
 * HTML/JSON noise, redacts PII/secrets, collapses whitespace, caps length.
 * Never throws, never returns raw markup.
 */
export function sanitizeRouteErrorMessage(input: unknown): string {
  let text: string;
  if (typeof input === "string") text = input;
  else if (input == null) text = "";
  else {
    try {
      text = String(input);
    } catch {
      text = "";
    }
  }
  text = text.replace(/<[^>]*>/g, " ").replace(/[{}[\]"]+/g, " ");
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, "[redacted]");
  }
  text = text.replace(/\s+/g, " ").trim();
  const max = ROUTE_VALIDATION_CONFIG.maxMessageLength;
  if (text.length > max) text = text.slice(0, max).trimEnd();
  return text || "Something went wrong. Please try again.";
}

/**
 * Maps a Zod-flattened `{ fieldErrors, formErrors }` payload (or a plain
 * message) to the first user-safe message, preferring config copy for known
 * route fields so "Validation failed" never shows without context.
 */
export function firstRouteServerMessage(details: {
  fieldErrors?: Record<string, string[] | undefined>;
  formErrors?: string[];
} | null | undefined, fallback: unknown): string {
  const fieldErrors = details?.fieldErrors ?? {};
  const orderedKeys = [
    "title",
    "description",
    "routes",
    "images",
    "tags",
    ...Object.keys(fieldErrors),
  ];
  for (const key of orderedKeys) {
    const msgs = fieldErrors[key];
    const first = Array.isArray(msgs) ? msgs.find(Boolean) : undefined;
    if (first) return sanitizeRouteErrorMessage(first);
  }
  const formFirst = details?.formErrors?.find(Boolean);
  if (formFirst) return sanitizeRouteErrorMessage(formFirst);
  return sanitizeRouteErrorMessage(fallback);
}

/**
 * Design-token error boundary class for inputs: red border + red focus ring
 * when `hasError`, default border otherwise. Mirrors AppInput/AppTextarea.
 */
export function fieldErrorClass(hasError: boolean): string {
  return hasError
    ? "border-error-border focus:border-error-border focus:shadow-[0_0_0_3px_rgba(127,29,29,0.12)]"
    : "border-border";
}
