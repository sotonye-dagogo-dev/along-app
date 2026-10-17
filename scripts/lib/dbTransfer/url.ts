/**
 * Connection-string resolution for transfer runs.
 *
 * Responsibilities:
 *  - pick a role's URL from the configured env candidates (explicit
 *    `DB_BACKUP_*` overrides first),
 *  - refuse URLs the `pg` driver cannot speak (`prisma+postgres://` is
 *    Prisma Accelerate's own protocol, not a SQL socket),
 *  - normalise TLS for hosts that require it without touching callers,
 *  - surface the dev-alias mismatch that would otherwise send development
 *    traffic to the wrong database after a cutover.
 *
 * Nothing here ever returns an un-redacted string for logging â€” use
 * `describeConnection()` / `redactConnectionString()` from the registry.
 */

import {
  DB_TRANSFER_CONFIG,
  describeConnection,
  fingerprintConnection,
  redactConnectionString,
  type DbRole,
} from "../../../app/lib/config/dbTransfer";

export interface ResolvedUrl {
  url: string;
  /** Env var the URL came from, or `null` when overridden by the caller. */
  fromVar: string | null;
  role: DbRole;
}

export class MissingConnectionError extends Error {
  readonly code = "MISSING_CONNECTION";
  readonly remedy: string;

  constructor(role: DbRole, remedy: string) {
    super(`No connection URL configured for role "${role}".`);
    this.name = "MissingConnectionError";
    this.remedy = remedy;
  }
}

export class UnsupportedUrlError extends Error {
  readonly code = "UNSUPPORTED_URL";
  readonly remedy: string;

  constructor(role: DbRole, raw: string, remedy: string) {
    super(
      `Connection URL for role "${role}" is not usable by this tool: ${describeConnection(raw)}`,
    );
    this.name = "UnsupportedUrlError";
    this.remedy = remedy;
  }
}

function roleConfig(role: DbRole) {
  const config = DB_TRANSFER_CONFIG.roles[role];
  if (!config) throw new MissingConnectionError(role, "Unknown role.");
  return config;
}

/**
 * Resolve a role's URL.
 *
 * @param overrides caller-supplied URL (`--source-url` / `--target-url`)
 * @param env defaults to `process.env`
 */
export function resolveRoleUrl(
  role: DbRole,
  overrides?: { url?: string; env?: Record<string, string | undefined> },
): ResolvedUrl {
  const env = overrides?.env ?? process.env;
  const explicit = (overrides?.url ?? "").trim();
  if (explicit) return { url: explicit, fromVar: null, role };

  const config = roleConfig(role);
  for (const key of config.envUrlCandidates) {
    const value = (env[key] ?? "").trim();
    if (!value) continue;
    return { url: value, fromVar: key, role };
  }

  throw new MissingConnectionError(
    role,
    `Set one of ${config.envUrlCandidates.join(", ")} in .env (or pass ${
      role === "legacy" ? "--source-url" : "--target-url"
    }).`,
  );
}

export interface NormalizedUrl {
  url: string;
  /** Human-readable notes to surface in the preflight report. */
  notes: string[];
}

/**
 * Make a URL safe to hand to `pg`:
 *  - reject schemes `pg` cannot open,
 *  - add the configured `sslmode` for TLS hosts that omitted one.
 *
 * Nothing else is rewritten — query params the caller supplied are kept.
 */
export function normalizePgUrl(resolved: ResolvedUrl): NormalizedUrl {
  const config = roleConfig(resolved.role);
  const parsed = fingerprintConnection(resolved.url);
  const notes: string[] = [];

  if (!parsed) {
    throw new UnsupportedUrlError(
      resolved.role,
      resolved.url,
      "The value is not a parseable URL. Expected postgresql://user:pass@host:port/db.",
    );
  }

  if (!config.allowedSchemes.includes(parsed.scheme)) {
    const isAccelerate = parsed.scheme.startsWith("prisma");
    throw new UnsupportedUrlError(
      resolved.role,
      resolved.url,
      isAccelerate
        ? "That is a Prisma Accelerate URL (prisma+postgres://) which speaks Prisma's own protocol, not SQL. Give this tool a direct postgresql:// URL - e.g. PREVIOUS_DIRECT_URL for the legacy database."
        : `Scheme "${parsed.scheme}://" cannot be opened by the pg driver. Use postgresql://.`,
    );
  }

  let url = resolved.url;
  const hasSslMode = /[?&]sslmode=/i.test(url);
  const host = parsed.host.toLowerCase();

  // Longest matching suffix wins, so a future more-specific rule (say
  // `pooler.supabase.com`) can override the generic one.
  const rule = [...config.sslModes]
    .sort((a, b) => b.suffix.length - a.suffix.length)
    .find((candidate) => host.endsWith(candidate.suffix.toLowerCase()));

  if (rule && !hasSslMode) {
    url += `${url.includes("?") ? "&" : "?"}sslmode=${rule.mode}`;
    notes.push(`TLS enforced (sslmode=${rule.mode}) for ${parsed.host} - ${rule.note}`);
  } else if (rule && /sslmode=disable/i.test(url)) {
    notes.push(
      `WARNING: sslmode=disable on ${parsed.host} - Postgres hosts of this type normally refuse plaintext connections.`,
    );
  }

  if (/([?&])pgbouncer=true/i.test(url)) {
    notes.push(
      `URL carries pgbouncer=true (port ${parsed.port || "?"}) â€” transaction-mode pooling. Prisma CLI/ORM honor it; the pg driver does not, so prefer the session/direct URL for bulk loads.`,
    );
  } else if (parsed.port === "6543") {
    notes.push(
      "URL targets port 6543 (transaction-mode pooler). Session-mode/direct (5432) is preferred for bulk transfers.",
    );
  }

  return { url, notes };
}

/** Convenience: resolve + normalize in one call. */
export function resolveUsableUrl(
  role: DbRole,
  overrides?: { url?: string; env?: Record<string, string | undefined> },
): NormalizedUrl & ResolvedUrl {
  const resolved = resolveRoleUrl(role, overrides);
  const normalized = normalizePgUrl(resolved);
  return { ...resolved, ...normalized };
}

/**
 * Detect the post-cutover trap: `resolveDatabaseUrl()` and `prisma.config.ts`
 * both prefer `DIRECT_LOCAL_DB` / `LOCAL_DB` whenever PROJECT_ENV is not
 * production, so stale values there silently keep development (and every
 * `prisma migrate`) pointed at the OLD database.
 *
 * Returns warning lines; empty when everything agrees or the alias is unset.
 */
export function detectDevAliasConflict(
  primaryUrl: string,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const primary = fingerprintConnection(primaryUrl);
  if (!primary) return [];

  const warnings: string[] = [];
  for (const key of DB_TRANSFER_CONFIG.devAliasEnvVars) {
    const raw = (env[key] ?? "").trim();
    if (!raw) continue;
    const fp = fingerprintConnection(raw);
    if (!fp) {
      warnings.push(`${key} is set but not a parseable URL.`);
      continue;
    }
    const sameHost = fp.host === primary.host;
    const sameDb = fp.database === primary.database;
    if (!sameHost || !sameDb || fp.scheme !== primary.scheme) {
      warnings.push(
        `${key} still resolves to ${describeConnection(raw)} â€” ` +
          `resolveDatabaseUrl()/prisma.config.ts prefer it in development, ` +
          `so dev runs and \`prisma migrate\` would use THAT database instead of ` +
          `${describeConnection(primaryUrl)}.`,
      );
    }
  }
  return warnings;
}

/** Redacted one-liner for reports. */
export function safeUrl(url: string): string {
  return redactConnectionString(url);
}
