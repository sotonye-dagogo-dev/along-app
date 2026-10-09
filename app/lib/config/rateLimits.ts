interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  global: { windowMs: 60000, maxRequests: 100, message: "Too many requests, please try again later." },
  auth: { windowMs: 900000, maxRequests: 10, message: "Too many login attempts. Try again in 15 minutes." },
  posts: { windowMs: 60000, maxRequests: 30 },
  likes: { windowMs: 60000, maxRequests: 60 },
  trace: { windowMs: 3600000, maxRequests: 20, message: "Route tracing limit reached (20/hour)." },
  comments: { windowMs: 60000, maxRequests: 20 },
  search: { windowMs: 60000, maxRequests: 30 },
  maps: { windowMs: 60000, maxRequests: 60, message: "Map requests are limited (60/min). Please try again shortly." },
};
