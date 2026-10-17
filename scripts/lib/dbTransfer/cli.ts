/**
 * Flag parsing + destructive-operation consent for the transfer scripts.
 *
 * Deliberately dependency-free (no commander/yargs) so the scripts stay
 * installable in a bare checkout and the parsing rules are unit-testable.
 *
 * Accepted forms:
 *   --flag                 boolean true
 *   --flag=value           string
 *   --flag value           string (when the next token is not another flag)
 *   --no-flag              boolean false
 *   positional arguments   collected separately
 *
 * Consent rules live here because they are the last line of defence before
 * anything destructive: a non-empty target may only be overwritten when the
 * operator explicitly asked, and automation must ask just as loudly as a
 * human (no silent non-TTY defaults).
 */

import { DB_TRANSFER_CONFIG } from "../../../app/lib/config/dbTransfer";
import { TransferSafetyError } from "./types";

export interface ParsedArgs {
  flags: Record<string, string | boolean>;
  positionals: string[];
}

const VALUE_FLAGS = new Set<string>(DB_TRANSFER_CONFIG.flags.valueFlags);
const BOOLEAN_FLAGS = new Set<string>(DB_TRANSFER_CONFIG.flags.booleanFlags);

/**
 * Parse `--flag`, `--flag=value`, `--flag value`, `--no-flag` and positionals.
 *
 * Only flags declared as value-taking in the registry consume the following
 * token. That keeps `--replace backup.jsonl` meaning "replace, then this
 * file" rather than "replace with value backup.jsonl".
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const body = token.slice(2);
    const eq = body.indexOf("=");
    if (eq >= 0) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }

    if (body.startsWith("no-")) {
      const name = body.slice(3);
      if (name) flags[name] = false;
      continue;
    }

    const next = argv[i + 1];
    const nextIsFlag = next !== undefined && next.startsWith("-");

    // A value flag consumes the next token, but NEVER another flag — so
    // `--source --target` means "source is true, target is true", not
    // "source = --target". Unknown flags follow the same rule.
    const takesValue =
      !nextIsFlag &&
      next !== undefined &&
      (VALUE_FLAGS.has(body) || !BOOLEAN_FLAGS.has(body));

    if (takesValue && next !== undefined) {
      flags[body] = next;
      i += 1;
      continue;
    }

    flags[body] = true;
  }

  return { flags, positionals };
}

export function flagString(args: ParsedArgs, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = args.flags[name];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

export function flagBool(args: ParsedArgs, ...names: string[]): boolean {
  for (const name of names) {
    const value = args.flags[name];
    if (value === true) return true;
    if (value === false) return false;
    if (typeof value === "string") {
      return ["1", "true", "yes", "y"].includes(value.toLowerCase());
    }
  }
  return false;
}

/** `--replace` / `--yes` â€” the operator's explicit consent to overwrite. */
export function hasReplaceConsent(args: ParsedArgs): boolean {
  return (
    flagBool(args, DB_TRANSFER_CONFIG.destructive.replaceFlag) ||
    flagBool(args, ...DB_TRANSFER_CONFIG.destructive.aliasFlags) ||
    flagBool(args, "force")
  );
}

export interface ConsentPrompt {
  /** Is a human attached to this terminal? */
  isTty?: boolean;
  /** Injected in tests. Defaults to Node's readline question. */
  ask?: (question: string) => Promise<string>;
}

async function defaultAsk(question: string): Promise<string> {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise<string>((resolve) => rl.question(question, resolve));
  } finally {
    rl.close();
  }
}

/**
 * Decide whether a destructive overwrite may proceed.
 *
 *  - consent flag present â†’ proceed (scriptable path)
 *  - interactive terminal  â†’ prompt for an explicit `y`
 *  - otherwise             â†’ refuse with a remedy
 *
 * Never returns `true` implicitly; the caller must still take the safety
 * backup before clearing anything.
 */
export async function confirmDestructiveAction(params: {
  summary: string;
  consentGiven: boolean;
  prompt?: ConsentPrompt;
}): Promise<boolean> {
  if (params.consentGiven) return true;

  const isTty = params.prompt?.isTty ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!isTty) {
    throw new TransferSafetyError(
      `${params.summary}\nRefusing to overwrite a non-empty database without explicit consent ` +
        `(non-interactive session).`,
      `Re-run with --${DB_TRANSFER_CONFIG.destructive.replaceFlag} if that is really what you want.`,
    );
  }

  const ask = params.prompt?.ask ?? defaultAsk;
  const answer = await ask(`${params.summary}\nProceed? [y/N] `);
  return /^y(es)?$/i.test(answer.trim());
}

/** `--help` text assembled from the registry so usage never drifts. */
export function usage(title: string, lines: readonly string[]): string {
  return [
    "",
    DB_TRANSFER_CONFIG.copy.banner(title),
    ...lines,
    "",
    "Flags:",
    // Every description must start at column 22 (2-space indent + a
    // 20-wide flag field), which is what the hand-written lines below use.
    `  ${`--${DB_TRANSFER_CONFIG.destructive.replaceFlag}`.padEnd(20)}permit overwriting a non-empty target (safety backup is taken first)`,
    "  --fresh             ignore any resumable backup and start over",
    "  --source-url=<url>  override the source connection string",
    "  --target-url=<url>  override the target connection string",
    "  --verify-mode=<m>   full | counts",
    "  --quiet             suppress row-level progress",
    "  --help              show this message",
    "",
    "Environment:",
    "  DB_BACKUP_DIR              dump directory (default backups/db-transfer)",
    "  DB_BACKUP_JOURNAL          journal path  (default backups/db-transfer/state.json)",
    // Description column is 29 (2-space indent + a 27-wide key field with no
    // extra space), matching the hand-written lines above. padEnd(26) plus a
    // space falls one short for DB_BACKUP_FRESHNESS_MINUTES (27 chars).
    `  ${DB_TRANSFER_CONFIG.resume.envKey.padEnd(27)}resume freshness window in minutes (default ${DB_TRANSFER_CONFIG.resume.freshnessMinutes})`,
    `  ${DB_TRANSFER_CONFIG.verify.envKey.padEnd(27)}full | counts`,
    `  ${DB_TRANSFER_CONFIG.safetyBackup.envKey.padEnd(27)}set to "false" to skip target safety backups (NOT recommended)`,
    "",
  ].join("\n");
}

/** Read numeric env overrides with a floor/ceiling guard. */
export function envInt(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
  bounds: { min?: number; max?: number } = {},
): number {
  const raw = (env[key] ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  const min = bounds.min ?? 0;
  const max = bounds.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(min, parsed));
}

/** Whether the configured safety backup may be skipped (`DB_BACKUP_SAFETY_BACKUP=false`). */
export function safetyBackupEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env[DB_TRANSFER_CONFIG.safetyBackup.envKey] ?? "").trim().toLowerCase();
  if (raw === "") return DB_TRANSFER_CONFIG.safetyBackup.enabled;
  return !["0", "false", "no", "off"].includes(raw);
}

/** Verify mode resolution: CLI flag > env > registry default. */
export function resolveVerifyMode(
  env: Record<string, string | undefined> = process.env,
  override?: string,
): "full" | "counts" {
  const candidate = (override ?? env[DB_TRANSFER_CONFIG.verify.envKey] ?? "").trim().toLowerCase();
  if (candidate === "counts") return "counts";
  if (candidate === "full") return "full";
  return DB_TRANSFER_CONFIG.verify.mode;
}
