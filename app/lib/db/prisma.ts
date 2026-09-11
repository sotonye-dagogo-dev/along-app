import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDatabaseUrl(): string {
  const isDev = process.env.NODE_ENV !== "production" || process.env.PROJECT_ENV === "development";
  if (isDev) {
    return (
      process.env.DIRECT_LOCAL_DB ||
      process.env.LOCAL_DB ||
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL ||
      ""
    );
  }
  return process.env.DIRECT_URL || process.env.DATABASE_URL || process.env.DIRECT_LOCAL_DB || process.env.LOCAL_DB || "";
}

function createPrismaClient(): PrismaClient {
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
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
