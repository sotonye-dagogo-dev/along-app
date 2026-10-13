import { NextResponse } from "next/server";
import { RATE_LIMITS } from "@/app/lib/config/rateLimits";

const ipMap = new Map<string, { count: number; resetAt: number }>();

function getIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "127.0.0.1";
}

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; response: NextResponse };

export function checkRateLimit(
  request: Request,
  bucket: keyof typeof RATE_LIMITS
): RateLimitResult {
  const config = RATE_LIMITS[bucket];
  if (!config) return { allowed: true };

  const ip = getIp(request);
  // Per-bucket counters: the previous single-key map let unrelated buckets
  // (auth/search/posts) consume the maps budget, so location autocomplete
  // could 429 (and silently clear suggestions) under normal browsing.
  const key = `${ip}::${String(bucket)}`;
  const now = Date.now();
  const entry = ipMap.get(key);

  if (!entry || now > entry.resetAt) {
    ipMap.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: config.message ?? "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) } }
      ),
    };
  }

  entry.count++;
  return { allowed: true };
}
