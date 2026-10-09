import { z } from "zod";
import { ROUTE_VALIDATION_CONFIG } from "@/app/lib/config/routeValidation";

/** Empty-string-tolerant optional text: "" (e.g. untouched optional inputs) parses as undefined. */
const optionalText = (min: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim().length === 0 ? undefined : v),
    z.string().min(min).optional()
  );

/** Strict fare: blank/undefined = no fare; numeric strings are coerced once;
 *  ranges ("400-500") coerce to NaN and fail with a guided message. */
const fareSchema = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length === 0) return undefined;
      const normalized = t.replace(/[₦,\s]/g, "");
      // A range or free text must not silently coerce — force NaN to fail.
      if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
      return Number(normalized);
    }
    return v;
  },
  z
    .number(ROUTE_VALIDATION_CONFIG.fareInvalid)
    .refine(
      (n) => Number.isFinite(n),
      ROUTE_VALIDATION_CONFIG.fareInvalid
    )
    .refine((n) => n >= 0, ROUTE_VALIDATION_CONFIG.fareNegative)
    .refine(
      (n) => n <= ROUTE_VALIDATION_CONFIG.fareMax,
      ROUTE_VALIDATION_CONFIG.fareTooLarge
    )
    .optional()
);

export const POST_ROUTE_STEP_SCHEMA = z.object({
  location: z
    .string(ROUTE_VALIDATION_CONFIG.locationRequired)
    .trim()
    .min(1, ROUTE_VALIDATION_CONFIG.locationRequired)
    .max(
      ROUTE_VALIDATION_CONFIG.locationMax,
      ROUTE_VALIDATION_CONFIG.locationTooLong
    ),
  description: z.string().max(500).optional(),
  vehicle: z.string().max(30).optional(),
  fare: fareSchema,
});

export const CREATE_POST_SCHEMA = z.object({
  title: z
    .string(ROUTE_VALIDATION_CONFIG.titleRequired)
    .trim()
    .min(ROUTE_VALIDATION_CONFIG.titleMin, ROUTE_VALIDATION_CONFIG.titleTooShort)
    .max(ROUTE_VALIDATION_CONFIG.titleMax, ROUTE_VALIDATION_CONFIG.titleTooLong),
  description: optionalText(10),
  type: z.enum(["ROUTE", "ROUTE_REQUEST", "ROUTE_RESPONSE"]).default("ROUTE"),
  quotedPostId: z.string().min(1).optional(),
  routes: z.array(POST_ROUTE_STEP_SCHEMA).min(2, "At least 2 route steps required"),
  images: z.array(z.string()).optional(),
  tags: z.array(z.string()).max(10).optional(),
  region: z.string().optional(),
  startLat: z.number().optional(),
  startLng: z.number().optional(),
  endLat: z.number().optional(),
  endLng: z.number().optional(),
  waypoints: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
  totalDistanceKm: z.number().optional(),
  estimatedMins: z.number().optional(),
});

export const UPDATE_POST_SCHEMA = CREATE_POST_SCHEMA.partial();

export const COMMENT_SCHEMA = z.object({
  text: z.string().min(1, "Comment cannot be empty").max(1000),
});

export const FEED_QUERY_SCHEMA = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
});
