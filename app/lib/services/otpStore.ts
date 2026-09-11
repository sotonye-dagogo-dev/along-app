// Centralized OTP / reset-token storage with Redis fallback to in-memory.
// Previously each route had its own isolated Map => OTP generated in /register was invisible to /otp verification.
// This module provides singleton stores shared across all auth routes.

type OtpEntry = { hash: string; expiry: number };
type ResetEntry = { email: string; hash: string; expiry: number };

// Singleton in-memory fallbacks (shared across imports)
const otpMemoryStore = new Map<string, OtpEntry>();
const resetMemoryStore = new Map<string, ResetEntry>();

async function getRedis(): Promise<import("@upstash/redis").Redis | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

export async function setOtp(key: string, hash: string, ttlSeconds = 900): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(key, hash, { ex: ttlSeconds });
      return;
    } catch (e) {
      console.error("[otpStore] redis set failed, falling back to memory", e);
    }
  }
  otpMemoryStore.set(key, { hash, expiry: Date.now() + ttlSeconds * 1000 });
}

export async function getOtp(key: string): Promise<string | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      const val = await redis.get<string>(key);
      if (val) return val;
      // fall through to memory as fallback (in case key was set in memory before env configured)
    } catch (e) {
      console.error("[otpStore] redis get failed, checking memory", e);
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
      await redis.del(key);
    } catch (e) {
      console.error("[otpStore] redis del failed", e);
    }
  }
  otpMemoryStore.delete(key);
}

export async function setResetToken(key: string, hash: string, ttlSeconds = 3600): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(key, hash, { ex: ttlSeconds });
      return;
    } catch (e) {
      console.error("[otpStore] redis set reset failed, falling back to memory", e);
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
      const val = await redis.get<string>(key);
      if (val) return val;
    } catch (e) {
      console.error("[otpStore] redis get reset failed, checking memory", e);
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
      await redis.del(key);
    } catch (e) {
      console.error("[otpStore] redis del reset failed", e);
    }
  }
  resetMemoryStore.delete(key);
}
