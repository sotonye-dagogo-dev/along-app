/**
 * Script A â€” one-shot cutover: Prisma Postgres (legacy) â†’ Supabase.
 *
 *   npm run db:migrate-supabase
 *   npm run db:migrate-supabase -- --replace
 *   npm run db:migrate-supabase -- --fresh
 *   npm run db:migrate-supabase -- --dry-run
 *   npm run db:migrate-supabase -- --check
 *
 * What it does, in order:
 *   1. resolves both connections (legacy from PREVIOUS_DIRECT_URL, Supabase
 *      from DIRECT_URL) and warns if the dev aliases still point at Prisma;
 *   2. reuses a COMPLETE, uncorrupted, recent, not-yet-consumed backup
 *      instead of re-dumping â€” so a run interrupted after the copy succeeded
 *      simply continues where it stopped;
 *   3. otherwise dumps the legacy database to a sha256-checksummed JSONL file;
 *   4. inspects Supabase â€” if it already contains exactly this backup, the
 *      run short-circuits to "done" rather than demanding --replace;
 *   5. clears Supabase only when it is non-empty AND --replace was given,
 *      and only after a verified local safety backup of it succeeded;
 *   6. applies `prisma migrate deploy` if the schema is missing;
 *   7. loads everything in ONE transaction, verifies row counts + content
 *      hashes BEFORE committing, then marks the backup consumed.
 *
 * Failsafe summary: a failure anywhere leaves Supabase byte-identical to
 * how it started (transaction rollback), and the local backup file survives
 * on disk for a retry or a manual restore.
 */

import { DB_TRANSFER_CONFIG } from "../app/lib/config/dbTransfer";
import { parseArgs, usage } from "./lib/dbTransfer/cli";
import { runMain } from "./lib/dbTransfer/main";
import { runTransfer } from "./lib/dbTransfer/runbook";

const args = parseArgs(process.argv.slice(2));

const USAGE = usage("db:migrate-supabase â€” legacy Prisma Postgres â†’ Supabase", [
  "Copies the legacy Prisma Postgres database into Supabase, resumably and",
  "with the target restored to its original state on any failure.",
  "",
  "The first run may clear Supabase (it is expected to be empty). Later runs",
  "never clear it unless --replace is passed explicitly.",
]);

void runMain({
  title: "db:migrate-supabase â€” legacy Prisma Postgres â†’ Supabase",
  usage,
  usageLines: [
    "Script A. Backs up the legacy database locally, then restores it into",
    "Supabase. Resumes automatically if a recent uncorrupted backup exists.",
    "",
    "Typical first run:   npm run db:migrate-supabase",
    "Overwrite a live DB: npm run db:migrate-supabase -- --replace",
    "Force a fresh dump:  npm run db:migrate-supabase -- --fresh",
  ],
  wantsHelp: args.flags.help === true,
  run: async (log) => {
    await runTransfer({
      title: "Script A â€” migrate Prisma Postgres â†’ Supabase",
      sourceRole: "legacy",
      targetRole: "supabase",
      plan: DB_TRANSFER_CONFIG.plans.migrate,
      args,
      env: process.env,
      log,
      dryRun: args.flags["dry-run"] === true,
      checkOnly: args.flags.check === true,
    });
  },
});
