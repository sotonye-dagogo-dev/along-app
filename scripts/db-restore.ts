/**
 * Generic local restore â€” load a verified backup file into a database.
 *
 *   npm run db:restore-local -- --latest --target=supabase
 *   npm run db:restore-local -- --file=backups/db-transfer/legacy-to-supabase-â€¦.jsonl --target=supabase
 *   npm run db:restore-local -- --latest --target=supabase --replace
 *
 * The file is integrity-checked BEFORE a single row is written, and the
 * load itself runs in one transaction with verification before COMMIT â€”
 * so a bad file or a bad target leaves the database exactly as it was.
 *
 * A non-empty target requires `--replace`, and even then a verified local
 * safety backup of that target is taken first.
 */

import { DB_TRANSFER_CONFIG } from "../app/lib/config/dbTransfer";
import { flagString, parseArgs, usage } from "./lib/dbTransfer/cli";
import { runMain } from "./lib/dbTransfer/main";
import { runTransfer } from "./lib/dbTransfer/runbook";
import { latestBackupFile } from "./lib/dbTransfer/state";
import { TransferSafetyError } from "./lib/dbTransfer/types";

const args = parseArgs(process.argv.slice(2));

const USAGE = usage("db:restore-local â€” load a backup file into a database", [
  "Restores a previously-taken snapshot. The file is fully verified first,",
  "and the load is all-or-nothing.",
]);

void runMain({
  title: "db:restore-local â€” verified restore from a local file",
  usage,
  usageLines: [
    "--latest          use the newest file in the backup directory",
    "--file=<path>     use an explicit file",
    "--target=supabase restore into Supabase (default)",
    "--target=legacy   restore into the legacy Prisma Postgres database",
  ],
  wantsHelp: args.flags.help === true,
  run: async (log) => {
    const requested = (flagString(args, "target") ?? "supabase").toLowerCase();
    if (requested !== "legacy" && requested !== "supabase") {
      throw new TransferSafetyError(
        `Unknown --target \"${requested}\".`,
        "Use --target=supabase or --target=legacy.",
      );
    }

    const explicit = flagString(args, "file");
    let file = explicit;

    if (!file) {
      const newest = latestBackupFile(undefined, process.env);
      if (!newest) {
        throw new TransferSafetyError(
          "No backup files found in the backup directory.",
          "Run `npm run db:backup-local` first, or pass --file=<path> explicitly.",
        );
      }
      file = newest.path;
      log.info(`--latest resolved to ${newest.fileName} (${(newest.bytes / 1024).toFixed(0)} KB)`);
    }

    await runTransfer({
      title: `db:restore-local â€” restore into ${DB_TRANSFER_CONFIG.roles[requested].label}`,
      // The source is the file itself, not a database.
      sourceRole: null,
      targetRole: requested,
      plan: DB_TRANSFER_CONFIG.plans.restore,
      args,
      env: process.env,
      log,
      fixedFile: file,
      dryRun: args.flags["dry-run"] === true,
      checkOnly: args.flags.check === true,
    });
  },
});
