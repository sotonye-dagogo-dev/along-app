/**
 * Prisma Configuration (Prisma 7+)
 *
 * Root config used by Prisma CLI.
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

const projectEnv = (
    process.env.PROJECT_ENV || process.env.NODE_ENV || "development"
).toLowerCase();
const isDev = projectEnv === "development";
// Support both DIRECT_* and legacy LOCAL_DB / DATABASE_URL names for flexibility across envs
const datasourceUrl = isDev
    ? process.env.DIRECT_LOCAL_DB || process.env.LOCAL_DB || process.env.DIRECT_URL || process.env.DATABASE_URL
    : process.env.DIRECT_URL || process.env.DATABASE_URL || process.env.DIRECT_LOCAL_DB || process.env.LOCAL_DB;

// Only throw during explicit Prisma CLI operations, not during build time
if (!datasourceUrl && process.argv[1]?.includes("prisma")) {
    throw new Error(
        "Missing datasource URL. Set DIRECT_LOCAL_DB for development or DIRECT_URL/DATABASE_URL for production.",
    );
}

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "tsx prisma/seed.ts",
    },
    datasource: {
        url: datasourceUrl || "postgresql://",
    },
});
