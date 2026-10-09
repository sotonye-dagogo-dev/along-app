import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl, isProduction } from "@/app/lib/config/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

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

  const adapter = new PrismaPg({ connectionString: dbUrl });
  return new PrismaClient({ adapter } as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction()) {
  globalForPrisma.prisma = prisma;
}
