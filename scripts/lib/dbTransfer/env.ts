/**
 * `.env` loading for the command-line entry points.
 *
 * The Next.js dev server and `next build` load `.env` files automatically.
 * These scripts do NOT run inside Next — they are plain `tsx` processes —
 * so without this module every CLI would silently see an empty environment
 * and fail with "No connection URL configured for role ...", which reads
 * like a configuration problem but is really a loading one.
 *
 * Rules honoured here:
 *  - precedence matches Next.js (`.env.local` beats `.env`), so a value
 *    the app would use is the same value the script uses,
 *  - an already-exported shell variable WINS, so an operator can point a
 *    one-off run at another host without editing any file,
 *  - nothing is logged, because connection URLs live in these files.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

/** The subset of `process.env` this module accepts, kept structural so
 * tests can pass a plain object. */
export type EnvLike = Record<string, string | undefined>;

/**
 * `.env` files consulted, highest precedence first. Mirrors the order
 * Next.js uses in development.
 */
export const ENV_FILES = [".env.local", ".env.development.local", ".env"] as const;

export interface LoadedEnvFile {
  /** File name as written on disk. */
  file: string;
  /** How many keys it declared (whether or not they overrode anything). */
  declaredKeys: number;
  /** How many of those keys were actually written into the environment. */
  appliedKeys: number;
}

export interface LoadEnvOptions {
  /** Directory to look in. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Environment to populate. Defaults to `process.env`. */
  env?: EnvLike;
  /** Extra file names to try, after the standard ones. */
  extraFiles?: readonly string[];
}

/**
 * Load `.env` files into `env` without overriding keys that are already
 * set. Returns one record per file that existed — including files that
 * contributed nothing because the shell already had those values, which is
 * exactly the situation an operator needs to be able to see.
 *
 * Never throws: a malformed line is dotenv's problem to skip, and a missing
 * file is simply not loaded.
 */
export function loadEnvFiles(options: LoadEnvOptions = {}): LoadedEnvFile[] {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const candidates = [...ENV_FILES, ...(options.extraFiles ?? [])];

  const loaded: LoadedEnvFile[] = [];

  for (const file of candidates) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) continue;

    const before = countSet(env);

    let declared = 0;
    try {
      const result = loadDotenv({
        path,
        // dotenv's type wants `Record<string, string>`, but `process.env`
        // (and therefore our EnvLike) permits `undefined`. dotenv never
        // writes an undefined value, so the narrowing is sound.
        processEnv: env as Record<string, string>,
        // Never clobber the shell: `FOO=x npm run db:backup-local` must win.
        override: false,
        // dotenv 17 logs a promotional banner unless asked to stay quiet;
        // these scripts must only print their own report.
        quiet: true,
      });
      declared = Object.keys(result.parsed ?? {}).length;
    } catch {
      // A file we cannot parse must not abort a migration attempt — the
      // preflight will still fail loudly if a URL ends up missing.
      declared = 0;
    }

    loaded.push({ file, declaredKeys: declared, appliedKeys: countSet(env) - before });
  }

  return loaded;
}

function countSet(env: EnvLike): number {
  let n = 0;
  for (const value of Object.values(env)) if (value !== undefined) n += 1;
  return n;
}

/**
 * One-line operator summary, e.g.
 * `env: .env (34 keys, 34 applied)`. Empty string when nothing was loaded.
 */
export function describeLoadedEnv(loaded: readonly LoadedEnvFile[]): string {
  if (loaded.length === 0) return "";
  return `env: ${loaded
    .map((f) => `${f.file} (${f.appliedKeys}/${f.declaredKeys} keys applied)`)
    .join(", ")}`;
}
