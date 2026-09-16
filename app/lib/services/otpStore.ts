// Centralized OTP / reset-token storage with Redis fallback to in-memory.
// Previously each route had its own isolated Map => OTP generated in /register was invisible to /otp verification.
// This module provides singleton stores shared across all auth routes.
// Now hardened: singleton Redis client, operation timeout (<< Vercel 10s limit), graceful fallback to memory.

type OtpEntry = { hash: string; expiry: number };
type ResetEntry = { email: string; hash: string; expiry: number };

// Singleton in-memory fallbacks (shared across imports)
const otpMemoryStore = new Map<string, OtpEntry>();
const resetMemoryStore = new Map<string, ResetEntry>();

const REDIS_OP_TIMEOUT_MS = 2500;

let _redisClient: import("@upstash/redis").Redis | null | undefined = undefined;
let _lastEnvKey: string | null = null;

function resolveEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN || "";
  if (!url || !token) return null;
  if (url.includes("replace_me") || token.includes("replace_me")) return null;
  if (!url.startsWith("https://")) return null;
  return { url, token };
}

async function getRedis(): Promise<import("@upstash/redis").Redis | null> {
  const env = resolveEnv();
  const envKey = env ? `${env.url}::${env.token.slice(0, 8)}` : "__none__";
  // Invalidate cached client if env rotated (user rotated Upstash vars)
  if (_redisClient !== undefined && _lastEnvKey !== null && _lastEnvKey !== envKey) {
    _redisClient = undefined;
  }
  if (_redisClient !== undefined) return _redisClient;
  _lastEnvKey = envKey;
  if (!env) {
    _redisClient = null;
    return null;
  }
  try {
    const { Redis } = await import("@upstash/redis");
    _redisClient = new Redis(env);
    return _redisClient;
  } catch {
    _redisClient = null;
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms = REDIS_OP_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Redis timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]) as Promise<T>;
}

export async function setOtp(key: string, hash: string, ttlSeconds = 900): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await withTimeout(redis.set(key, hash, { ex: ttlSeconds }));
      return;
    } catch (e) {
      const msg = (e as Error).message;
      console.warn("[otpStore] redis set failed, falling back to memory", msg);
      // Memory fallback is per-instance only; warn in production so ops can fix Upstash config
      if (msg.includes("timeout")) {
        console.warn("[otpStore] Redis timeout suggests Upstash latency or misconfig — token stored in memory (non-durable across serverless instances)");
      }
    }
  }
  otpMemoryStore.set(key, { hash, expiry: Date.now() + ttlSeconds * 1000 });
}

export async function getOtp(key: string): Promise<string | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      const val = await withTimeout(redis.get<string>(key));
      if (val) return val;
      // fall through to memory as fallback (in case key was set in memory before env configured)
    } catch (e) {
      console.warn("[otpStore] redis get failed, checking memory", (e as Error).message);
    }
  }
  const entry = otpMemoryStore.get(key);
  if (entry && entry.expiry > Date.now()) return entry.hash;
  if (entry) otpMemoryStore.delete(key);
  return null;
}

export async function delOtp(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await withTimeout(redis.del(key));
    } catch (e) {
      console.warn("[otpStore] redis del failed", (e as Error).message);
    }
  }
  otpMemoryStore.delete(key);
}

export async function setResetToken(key: string, hash: string, ttlSeconds = 3600): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await withTimeout(redis.set(key, hash, { ex: ttlSeconds }));
      return;
    } catch (e) {
      const msg = (e as Error).message;
      console.warn("[otpStore] redis set reset failed, falling back to memory", msg);
      if (msg.includes("timeout")) {
        console.warn("[otpStore] Redis timeout on reset token — memory fallback is non-durable across serverless instances; verify UPSTASH_REDIS_REST_URL/TOKEN");
      }
    }
  }
  // extract email from key for storage record
  const email = key.startsWith("reset:") ? key.slice(6) : "";
  resetMemoryStore.set(key, { email, hash, expiry: Date.now() + ttlSeconds * 1000 });
}

export async function getResetToken(key: string): Promise<string | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      const val = await withTimeout(redis.get<string>(key));
      if (val) return val;
    } catch (e) {
      console.warn("[otpStore] redis get reset failed, checking memory", (e as Error).message);
    }
  }
  const entry = resetMemoryStore.get(key);
  if (entry && entry.expiry > Date.now()) return entry.hash;
  if (entry) resetMemoryStore.delete(key);
  return null;
}

export async function delResetToken(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await withTimeout(redis.del(key));
    } catch (e) {
      console.warn("[otpStore] redis del reset failed", (e as Error).message);
    }
  }
  resetMemoryStore.delete(key);
}

// For tests
export function __resetOtpStoreForTests() {
  _redisClient = undefined;
  _lastEnvKey = null;
  otpMemoryStore.clear();
  resetMemoryStore.clear();
}
