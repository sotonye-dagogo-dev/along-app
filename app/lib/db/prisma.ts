import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isDev = process.env.NODE_ENV !== "production" || process.env.PROJECT_ENV === "development";

const accelerateUrl = isDev ? process.env.LOCAL_DB : process.env.DATABASE_URL;

// During `next build` without env, Prisma would throw ConstructorValidationError on empty accelerateUrl.
// Provide a dummy placeholder; queries will fail at runtime only if truly unconfigured, but build succeeds.
const prismaUrl = accelerateUrl && accelerateUrl.trim().length > 0 ? accelerateUrl : "prisma://dummy.placeholder?api_key=dummy";

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  accelerateUrl: prismaUrl,
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
