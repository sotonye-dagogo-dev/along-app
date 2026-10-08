import { z } from "zod";

export const POST_ROUTE_STEP_SCHEMA = z.object({
  location: z.string().min(1),
  description: z.string().optional(),
  vehicle: z.string().optional(),
  fare: z.number().optional(),
});

export const CREATE_POST_SCHEMA = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  description: z.string().min(10).optional(),
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
