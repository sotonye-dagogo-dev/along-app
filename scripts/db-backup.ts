/**
 * Generic local backup â€” dump a role's database to a checksummed file.
 *
 *   npm run db:backup-local -- --source=legacy
 *   npm run db:backup-local -- --source=supabase
 *   npm run db:backup-local -- --source=supabase --check
 *
 * Read-only with respect to the database: it never writes to the source.
 * The output lands in `backups/db-transfer/` (gitignored) and is verified
 * by re-reading it end-to-end before the command reports success.
 */

import { DB_TRANSFER_CONFIG } from "../app/lib/config/dbTransfer";
import { TransferSafetyError } from "./lib/dbTransfer/types";
import { flagString, parseArgs, usage } from "./lib/dbTransfer/cli";
import { runMain } from "./lib/dbTransfer/main";
import { runTransfer } from "./lib/dbTransfer/runbook";

const args = parseArgs(process.argv.slice(2));

const USAGE = usage("db:backup-local â€” dump a database to a local file", [
  "Takes a verified, resumable snapshot of one database on this machine.",
  "Nothing on the source is modified.",
]);

void runMain({
  title: "db:backup-local â€” verified local database snapshot",
  usage,
  usageLines: [
    "--source=legacy   dump the legacy Prisma Postgres database",
    "--source=supabase dump the Supabase database (default)",
  ],
  wantsHelp: args.flags.help === true,
  run: async (log) => {
    const requested = (flagString(args, "source") ?? "supabase").toLowerCase();
    if (requested !== "legacy" && requested !== "supabase") {
      throw new TransferSafetyError(
        `Unknown --source \"${requested}\".`,
        "Use --source=legacy or --source=supabase.",
      );
    }

    await runTransfer({
      title: `db:backup-local â€” snapshot ${DB_TRANSFER_CONFIG.roles[requested].label}`,
      sourceRole: requested,
      // No target: the artifact is the local file itself.
      targetRole: null,
      plan: DB_TRANSFER_CONFIG.plans.backup,
      args,
      env: process.env,
      log,
      checkOnly: args.flags.check === true,
    });
  },
});
