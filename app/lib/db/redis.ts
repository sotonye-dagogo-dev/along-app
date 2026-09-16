import { Redis } from "@upstash/redis";

const REDIS_OP_TIMEOUT_MS = 1200;

type RedisClient = InstanceType<typeof Redis>;

let _client: RedisClient | null = null;
let _initialized = false;
let _lastEnvKey: string | null = null;

function resolveEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN || "";
  if (!url || !token) return null;
  if (url.includes("replace_me") || token.includes("replace_me")) return null;
  // Guard against placeholder / obviously invalid URLs (e.g. missing https)
  if (!url.startsWith("https://")) return null;
  return { url, token };
}

function envKeyOf(env: { url: string; token: string } | null): string {
  return env ? `${env.url}::${env.token.slice(0, 8)}` : "__none__";
}

function withTimeout<T>(promise: Promise<T>, ms = REDIS_OP_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Redis timeout after ${ms}ms`)), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeout,
  ]) as Promise<T>;
}

export function getRedisClient(): RedisClient | null {
  const env = resolveEnv();
  const key = envKeyOf(env);
  if (_initialized && _lastEnvKey === key) return _client;
  // Env rotated — invalidate cached client
  if (_initialized && _lastEnvKey !== key) {
    _client = null;
    _initialized = false;
  }
  _initialized = true;
  _lastEnvKey = key;
  if (!env) return null;
  try {
    _client = new Redis(env);
    return _client;
  } catch {
    _client = null;
    return null;
  }
}

/** For tests: reset singleton */
export function __resetRedisForTests() {
  _client = null;
  _initialized = false;
  _lastEnvKey = null;
}

// Safe wrapper — always timeout-guarded, never throws, falls back to null/no-op
export const redis = {
  async get<T>(key: string): Promise<T | null> {
    const c = getRedisClient();
    if (!c) return null;
    try {
      const val = await withTimeout(c.get<T>(key));
      return val as T | null;
    } catch (e) {
      console.warn("[redis] get failed", key, (e as Error).message);
      return null;
    }
  },
  async set(key: string, value: unknown, opts?: { ex: number }): Promise<void> {
    const c = getRedisClient();
    if (!c) return;
    try {
      await withTimeout(c.set(key, value as never, opts));
    } catch (e) {
      console.warn("[redis] set failed", key, (e as Error).message);
    }
  },
  async del(...keys: string[]): Promise<number> {
    const c = getRedisClient();
    if (!c) return 0;
    try {
      const res = await withTimeout(c.del(...keys));
      return res as number;
    } catch (e) {
      console.warn("[redis] del failed", (e as Error).message);
      return 0;
    }
  },
  // Expose raw client for advanced callers that already handle timeouts themselves
  _getClient: getRedisClient,
  _withTimeout: withTimeout,
};

export { withTimeout, REDIS_OP_TIMEOUT_MS };
