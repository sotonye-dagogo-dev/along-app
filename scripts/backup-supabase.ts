/**
 * Script B â€” ongoing backup strategy for the Supabase free plan.
 *
 *   npm run db:backup-supabase
 *   npm run db:backup-supabase -- --replace
 *   npm run db:backup-supabase -- --check
 *
 * Supabase's free tier has no automatic backups, so this script takes the
 * role of the nightly/weekly safety net. Each run produces BOTH copies the
 * directive asks for:
 *
 *   1. Supabase â†’ LOCAL FILE   (sha256-checksummed JSONL under backups/)
 *   2. Supabase â†’ PRISMA DB    (the same file replayed into PREVIOUS_DIRECT_URL,
 *                               which now acts purely as an offsite mirror)
 *
 * Order matters and is deliberate: the local file is written and verified
 * FIRST, and only then is the mirror attempted. If the mirror fails, you
 * still hold a good local copy; the Prisma database is never touched before
 * a verified local snapshot of Supabase exists.
 *
 * Overwriting the mirror is inherently destructive, so each run also takes
 * a safety snapshot of the Prisma database before clearing it â€” and the
 * whole load is one transaction that verifies before committing.
 *
 * Automate it with:  --replace   (non-interactive sessions refuse without it)
 */

import { DB_TRANSFER_CONFIG } from "../app/lib/config/dbTransfer";
import { parseArgs, usage } from "./lib/dbTransfer/cli";
import { runMain } from "./lib/dbTransfer/main";
import { runTransfer } from "./lib/dbTransfer/runbook";

const args = parseArgs(process.argv.slice(2));

const USAGE = usage("db:backup-supabase â€” Supabase â†’ local + Prisma mirror", [
  "Backs up Supabase twice: to a local file, and into the legacy Prisma",
  "Postgres database which now serves as an offsite mirror.",
  "",
  "Supabase's free plan has no automatic backups â€” schedule this run.",
]);

void runMain({
  title: "db:backup-supabase â€” Supabase â†’ local file + Prisma mirror",
  usage,
  usageLines: [
    "Runs both backup copies in one go. The local file is written and",
    "verified before the mirror is touched.",
    "",
    "Non-interactive/CI runs must pass --replace to allow the mirror",
    "overwrite (a safety snapshot of the mirror is taken first).",
  ],
  wantsHelp: args.flags.help === true,
  run: async (log) => {
    await runTransfer({
      title: "Script B â€” back up Supabase to disk and to the Prisma mirror",
      sourceRole: "supabase",
      targetRole: "legacy",
      plan: DB_TRANSFER_CONFIG.plans.mirror,
      args,
      env: process.env,
      log,
      dryRun: args.flags["dry-run"] === true,
      checkOnly: args.flags.check === true,
    });
  },
});
