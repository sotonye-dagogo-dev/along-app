/**
 * Central environment resolution — single source of truth for
 * PROJECT_ENV / NODE_ENV differentiation (config-driven, non-breaking).
 *
 * Rule: PROJECT_ENV wins when set (development | staging | production);
 * otherwise NODE_ENV decides. `isProduction()` is true only when the
 * effective env is "production" — so setting PROJECT_ENV=production with
 * NODE_ENV=development still hardens cookies, silences dev logs, and
 * enforces strict secrets.
 */

export type ProjectEnv = "development" | "staging" | "production" | "test";

export function getEffectiveEnv(): ProjectEnv {
  const raw = (process.env.PROJECT_ENV ?? process.env.NODE_ENV ?? "development")
    .toString()
    .trim()
    .toLowerCase();
  if (raw === "production" || raw === "prod") return "production";
  if (raw === "staging" || raw === "stage") return "staging";
  if (raw === "test" || raw.includes("test")) return "test";
  return "development";
}

export function isProduction(): boolean {
  return getEffectiveEnv() === "production";
}

export function isDevelopment(): boolean {
  return getEffectiveEnv() === "development";
}

export function isTest(): boolean {
  return getEffectiveEnv() === "test";
}

/** App URL with safe fallback (never empty). */
export function getAppUrl(): string {
  const url = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (url) return url.replace(/\/$/, "");
  return isProduction() ? "https://www.alongng.com" : "http://localhost:3000";
}

/**
 * Resolve the RUNTIME DB URL (PrismaClient / app queries only).
 *
 * Precedence prefers the TRANSACTION-mode pooler (DATABASE_URL / LOCAL_DB —
 * Supavisor port 6543) over DIRECT_URL / DIRECT_LOCAL_DB (session-mode
 * pooler, port 5432). Session mode caps concurrent clients at the dashboard
 * "Pool Size" (often 15) per database-role — a serverless fleet exhausts it
 * instantly (EMAXCONNSESSION). DIRECT_URL stays the Prisma CLI path
 * (migrations/seeds via `prisma.config.ts`, which keeps DIRECT-first on
 * purpose: DDL needs session continuity).
 *
 * Regression note (Sprint 77): the production branch used to return
 * `DIRECT_URL || DATABASE_URL`, which pointed every warm lambda at the
 * session-mode cap and 500'd feed/reviews/site-config/auth under load.
 */
export function resolveDatabaseUrl(): string {
  if (!isProduction()) {
    return (
      process.env.LOCAL_DB ||
      process.env.DIRECT_LOCAL_DB ||
      process.env.DATABASE_URL ||
      process.env.DIRECT_URL ||
      ""
    );
  }
  return (
    process.env.DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.DIRECT_LOCAL_DB ||
    process.env.LOCAL_DB ||
    ""
  );
}

/** Strict in production, lenient in dev — returns missing keys. */
export function missingEnvKeys(keys: string[]): string[] {
  return keys.filter((k) => !(process.env[k] ?? "").trim());
}
