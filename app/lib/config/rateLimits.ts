interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  global: { windowMs: 60000, maxRequests: 100, message: "Too many requests, please try again later." },
  auth: { windowMs: 900000, maxRequests: 10, message: "Too many login attempts. Try again in 15 minutes." },
  // Token refresh is NOT an auth attempt — its own (generous) bucket so an
  // installed PWA resuming after idle can never burn the login/OTP budget
  // (or be blocked by it). Same per-IP, per-instance accounting as `auth`.
  authRefresh: { windowMs: 900000, maxRequests: 45, message: "Too many session refreshes. Please try again shortly." },
  posts: { windowMs: 60000, maxRequests: 30 },
  likes: { windowMs: 60000, maxRequests: 60 },
  trace: { windowMs: 3600000, maxRequests: 20, message: "Route tracing limit reached (20/hour)." },
  comments: { windowMs: 60000, maxRequests: 20 },
  reviews: { windowMs: 60000, maxRequests: 10, message: "Too many review submissions. Please try again shortly." },
  search: { windowMs: 60000, maxRequests: 30 },
  maps: { windowMs: 60000, maxRequests: 60, message: "Map requests are limited (60/min). Please try again shortly." },
};
