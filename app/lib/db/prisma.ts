import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl, isProduction } from "@/app/lib/config/env";
import { buildPgAdapterOptions, isSessionModePoolerUrl } from "@/app/lib/config/dbPool";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let warnedSessionMode = false;

function createPrismaClient(): PrismaClient {
  /* eslint-disable @typescript-eslint/no-explicit-any -- runtime constructor options differ per delivery mode (adapter vs accelerateUrl) */
  const dbUrl = resolveDatabaseUrl().trim();

  // Build-time fallback: no DB URL configured (e.g. `next build` on CI without env)
  // Provide a dummy client that will fail only at query time, not at import time.
  if (!dbUrl) {
    const dummyAdapter = new PrismaPg({ connectionString: "postgresql://dummy:dummy@localhost:5432/dummy" });
    return new PrismaClient({ adapter: dummyAdapter } as any);
  }

  // Prisma Accelerate (prisma://) uses accelerateUrl; plain postgres uses adapter
  if (dbUrl.startsWith("prisma://") || dbUrl.startsWith("prisma+postgres://")) {
    return new PrismaClient({ accelerateUrl: dbUrl } as any);
  }

  // Pooler-aware pg options (Sprint 77): small per-instance pool, connect
  // timeout inside the serverless budget, idle release, and prepare:false
  // against transaction-mode Supavisor (prepared statements break there).
  const adapter = new PrismaPg(buildPgAdapterOptions(dbUrl));

  // One-time production signal: a session-mode pooler caps concurrent clients
  // at the dashboard Pool Size (EMAXCONNSESSION under serverless fan-out).
  // DATABASE_URL (transaction mode, port 6543) is the runtime URL per
  // .env.example — this warn makes a mis-set Vercel var obvious in logs.
  if (isProduction() && !warnedSessionMode && isSessionModePoolerUrl(dbUrl)) {
    warnedSessionMode = true;
    console.warn(
      "[prisma] runtime resolved a SESSION-mode pooler URL. Serverless runtimes should use " +
        "DATABASE_URL (transaction mode, port 6543); DIRECT_URL is for migrations only. " +
        "See .env.example and app/lib/config/dbPool.ts."
    );
  }

  return new PrismaClient({ adapter } as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

// Cache the singleton on globalThis in EVERY environment (not just dev): a
// second module copy (route-split chunks, dual ESM/CJS evaluation) would
// otherwise open a second pg pool against the same database — multiplying
// connections per warm instance, which is exactly the EMAXCONNSESSION class.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
