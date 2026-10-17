/**
 * Process bootstrap shared by the four `scripts/db-*.ts` entry points.
 *
 * Keeps each entry script down to "declare flags, call the runbook", and
 * guarantees one consistent contract for operators and for CI:
 *
 *   exit 0  success
 *   exit 1  a safety stop fired (nothing destructive happened)
 *   exit 2  an unexpected failure
 *
 * Every failure path prints the remedy, because a half-finished migration
 * is exactly the moment an operator needs to be told what to do next.
 */

import { TransferSafetyError } from "./types";
import { TransferLog, type TransferLogOptions } from "./log";
import { describeLoadedEnv, loadEnvFiles } from "./env";

export interface MainOptions {
  title: string;
  run: (log: TransferLog) => Promise<void>;
  log?: TransferLogOptions;
  /** Extra flags this specific command understands, for `--help`. */
  usageLines?: readonly string[];
  usage: (title: string, lines: readonly string[]) => string;
  wantsHelp?: boolean;
}

export async function runMain(options: MainOptions): Promise<void> {
  const log = new TransferLog(options.log);

  // These are plain `tsx` processes, not Next.js, so nothing loads `.env`
  // for us. Doing it here (rather than in each entry script) means a new
  // `db-*.ts` cannot forget and then mis-report a missing URL.
  const loaded = loadEnvFiles();

  if (options.wantsHelp) {
    console.log(options.usage(options.title, options.usageLines ?? []));
    return;
  }

  const envSummary = describeLoadedEnv(loaded);
  if (envSummary) log.info(envSummary);

  try {
    await options.run(log);
  } catch (error) {
    log.clearProgress();
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof TransferSafetyError) {
      log.error(message);
      log.line("");
      log.info(`Remedy: ${error.remedy}`);
      log.info("No data was modified by the safety check that stopped this run.");
      process.exitCode = 1;
      return;
    }

    log.error(message);
    if (error instanceof Error && error.stack && process.env.DB_BACKUP_DEBUG === "true") {
      log.line(error.stack);
    } else {
      log.info("Set DB_BACKUP_DEBUG=true to print the full stack trace.");
    }
    process.exitCode = 2;
  }
}
