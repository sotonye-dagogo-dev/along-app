# In Progress — DB Migration & Backup System (Prisma Postgres → Supabase)

> **Metadata**
> - command: `ai-system/commands/execute-feature.md`
> - started-by: execute-feature 2026-10-17
> - status: GO ✅ (2026-10-17) — IMPLEMENTING
> - architecture-impact: YES (new DB-transfer subsystem + env/config contract changes → `update-ai-system.md` required at close)
> - originating-task-queue-tag: `[L]` (new)

---

## Directive (verbatim intent)

Migrate the project DB from **Prisma Postgres** (usage limits caused outages) to a **Supabase** instance.

- User already swapped `DATABASE_URL` + `DIRECT_URL` → Supabase, and renamed the old Prisma values to `PREVIOUS_DATABASE_URL` / `PREVIOUS_DIRECT_URL` (kept for this migration + future backups).
- **Script A** — back up the Prisma DB to a local location, then load that backup entirely into Supabase. Must be *intuitive + resumable*: if a **complete, uncorrupted, extremely-recent backup that has not yet been consumed** exists (i.e. the run was interrupted *after* the copy succeeded), it must **skip the dump and continue uploading**.
- First run: Supabase is effectively empty → safe to clear/reload. **Future runs: back up, never clear.**
- Review the Prisma connection code (Prisma Accelerate was used before; ORM stays Prisma, only the Postgres instance changes) so nothing breaks.
- **Script B** — ongoing backup strategy for the Supabase free plan: Supabase → **local** *and* Supabase → **the Prisma DB**.
- Both scripts must give live progress feedback.
- **Data protection/integrity is non-negotiable**: backup + rollback strategies and failsafes, actually implementable.
- Update `.env.example`. Install node modules + run proper QA. Config/metadata-driven, reusable modular, non-breaking. Execute `update-ai-system.md` when done.

---

## Step 1 — Findings that shape the plan

### Env reality (`.env`, values inspected by hash/scheme/host only — no secrets read into logs)

| Var | Scheme | Host:Port | Role |
|-----|--------|-----------|------|
| `DATABASE_URL` | `postgresql` | `aws-1-eu-west-2.pooler.supabase.com:6543?pgbouncer` | **Supabase transaction-mode pooler (new)** |
| `DIRECT_URL` | `postgresql` | `aws-1-eu-west-2.pooler.supabase.com:5432` | **Supabase session-mode pooler (new)** — full PG session, DDL-capable |
| `PREVIOUS_DATABASE_URL` | `prisma+postgres` | `accelerate.prisma-data.net` | legacy Prisma Accelerate (prod) |
| `PREVIOUS_DIRECT_URL` | `postgres` | `pooled.db.prisma.io:5432` | legacy Prisma direct/pooled SQL (backup **source**) |
| `DIRECT_LOCAL_DB` | `postgres` | `db.prisma.io:5432` | ⚠️ legacy dev alias — **NOT switched** |
| `LOCAL_DB` | `prisma+postgres` | `accelerate.prisma.data.net` | ⚠️ legacy dev alias — **NOT switched** |

**Confirmed gap:** `app/lib/config/env.ts` `resolveDatabaseUrl()` and `prisma.config.ts` both prefer
`DIRECT_LOCAL_DB || LOCAL_DB` **in development** → a dev run of the app / `prisma migrate` still talks to
the **legacy Prisma DB**, not Supabase. This is the one real connection-code defect to resolve.

### Connection code review (`app/lib/db/prisma.ts`)

- Already correct for both delivery modes: `prisma://` / `prisma+postgres://` → `accelerateUrl`,
  plain `postgresql://` → `@prisma/adapter-pg` (`PrismaPg`). Supabase URLs take the **adapter** path — no change needed. ✅
- Build-time dummy adapter guard retained. ✅
- Prisma 7 constraint (repair-system 2026-06-10): never pass a `prisma+postgres://` URL to `datasourceUrl`.
  With Supabase on `DIRECT_URL`, `prisma.config.ts` resolves a real `postgresql://` → CLI (migrate/seed) is now correct in prod. ✅
- Residual risk to verify empirically in QA: `DATABASE_URL` is transaction-mode pgbouncer (6543) with `?pgbouncer=true`
  (inert for the `pg` driver) — must prove `PrismaPg` + `SELECT 1` works against it.

### Data-fidelity risk discovered during tool research (this is the crux of "integrity must be preserved")

`pg-types` default parsers **shift date/time values by the runner's local timezone**:

```
1114 timestamp      "2026-10-17 12:00:00.789" -> 2026-10-17T11:00:00.789Z   (UTC+1 runner)
1082 date           "2026-10-17"              -> 2026-10-16T23:00:00.000Z
```

Prisma maps `DateTime` → `timestamp(3)` **without** time zone, storing UTC literals. A naive
`Date → JSON → INSERT` round-trip would **silently corrupt every timestamp**. Mitigation is a hard
requirement in the design: override type parsers for `1114/1184/1082` to carry the **raw server text**
and re-insert that exact text (byte-identical, no TZ interpretation).

Other parser facts verified: `int8`/`numeric`/`uuid` → string, `json/jsonb` → parsed object,
`text[]` → JS array, `bytea` → Buffer. All covered by a tagged-value codec.

### Schema notes (`prisma/schema.prisma`)

- 24 app tables, all PKs are `String @id @default(cuid())` → no serial PK sequences (sync implemented anyway, config-gated).
- **FK cycle exists**: `Post.quotedPostId → Post.id` (self-relation) ⇒ needs two-phase insert
  (null cyclic FKs → insert → UPDATE pass) inside the single restore transaction.
- `Post.images` / `Post.tags` are `String[]`; several `Json` columns; one `Byte[]`-capable type — codec must cover.
- `_prisma_migrations` is bookkeeping → included in the backup file, **excluded from restore**
  (schema is rebuilt by `prisma migrate deploy`, which is the source of truth).

---

## Step 2 — Self-check vs scope + decisions

- `project-context.md` scope: primary store is "PostgreSQL (via Prisma)" — unchanged (ORM stays Prisma, only the
  instance changes). Out-of-scope sweep found nothing blocking.
- `memory/project-decisions.md` "Prisma 7 Client Construction" says *Accelerate via `DATABASE_URL` is preferred*.
  **This directive supersedes that** (Accelerate usage limits → direct Supabase). Will be recorded as an explicit
  decision update at close, not silently contradicted.
- No conflict → proceed.

---

## Decomposition

### New — `scripts/lib/dbTransfer/` (config-driven, reusable, zero app-runtime coupling)

| # | File | Responsibility |
|---|------|----------------|
| 1 | `config.ts` | `DB_TRANSFER_CONFIG` registry: directory layout, role→env-var preference lists, resume freshness window, batch/param caps, verify mode, bookkeeping-table exclusions, SSL host list, all log/copy strings |
| 2 | `types.ts` | Shared types (roles, headers, rows, footer, journal entries, stage enum) |
| 3 | `log.ts` | Staged progress feedback: step banners, per-table counts/percent, elapsed, warnings/errors, redaction |
| 4 | `checksum.ts` | Incremental sha256 + helpers |
| 5 | `url.ts` | Role→URL resolution, host/db fingerprint, **credential redaction**, `sslmode` normalization for known hosts |
| 6 | `codec.ts` | Tagged value encode/decode (`$d/$b/$i/$r/$j/$t`) + `pg.types` parser overrides for timestamp/date raw text |
| 7 | `introspect.ts` | Tables/columns/PK/FK/serial-sequence introspection; FK graph → Tarjan SCC → topological load order; cyclic-FK column detection |
| 8 | `dump.ts` | Streaming JSONL writer: header → row chunks → footer with sha256; `.part` → atomic rename; per-table content hashes |
| 9 | `read.ts` | Reader + integrity verification (truncation, sha256 mismatch, per-table hash/count mismatch) → typed `CorruptBackupError` |
| 10 | `state.ts` | Journal `state.json` (atomic tmp+rename): stages `created → restored → verified → consumed`, resume lookup, retention pruning |
| 11 | `restore.ts` | Preflight schema check → optional `prisma migrate deploy` → **one transaction**: optional clear, ordered inserts, two-phase cyclic FKs, sequence sync, in-transaction verification → commit or rollback |
| 12 | `verify.ts` | Row counts + canonical content-hash comparison (source file vs live target) |
| 13 | `cli.ts` | Flag parsing + destructive-op consent (`--replace`, non-TTY guard) |
| 14 | `index.ts` | Barrel |

### New — entry scripts

| # | File | npm script | Behaviour |
|---|------|-----------|-----------|
| 15 | `scripts/db-migrate-supabase.ts` | `db:migrate-supabase` | **Script A.** Stage machine: `find-resumable → dump → schema → load → verify → consume`. Reuses a recent valid unconsumed backup instead of re-dumping; clears Supabase only when empty (or `--replace`); never consumes an unverified backup |
| 16 | `scripts/db-backup.ts` | `db:backup-local` | Generic local backup, `--source legacy\|supabase` |
| 17 | `scripts/db-restore.ts` | `db:restore-local` | Generic restore from a file, `--target legacy\|supabase [--replace]` |
| 18 | `scripts/backup-supabase.ts` | `db:backup-supabase` | **Script B.** Supabase → local file **and** the same file → Prisma DB mirror (safety-backs the Prisma DB first, `--replace` required when non-empty) |

### Modified

| # | File | Change |
|---|------|--------|
| 19 | `.env.example` | Rewrite the Database block: Supabase (`DATABASE_URL` pooler / `DIRECT_URL` session) primary, `PREVIOUS_*` legacy-read-only, dev-alias guidance, new `DB_BACKUP_*` knobs, redaction note |
| 20 | `package.json` | 4 new `db:*` scripts |
| 21 | `app/lib/config/env.ts` | Non-breaking: add documented `resolveLegacyDatabaseUrl()` + dev-alias consistency helper (used by scripts; app path untouched) |

### Tests (Jest, `app/__tests__/dbTransfer/`)

codec round-trip incl. the **timestamp local-shift regression**; corruption/truncation detection; SCC + two-phase
cyclic-FK ordering; journal resume eligibility (fresh/valid/unused); CLI consent rules; URL redaction;
config shape. Pure functions only — no live DB in Jest.

### QA gate (mandatory)

`npm install` → `npx tsc --noEmit` → `npx jest` → `npx next lint` → `npm run build`,
**plus** real connectivity proofs: `SELECT 1` against Supabase via `PrismaPg(DATABASE_URL)` (pooler 6543) and
via `DIRECT_URL`, and a read-only fingerprint of the legacy source.

### Docs / close-out

README runbook section, `repair-system.md` entry (timezone-shift class), `system-architecture.md` (module +
config points), `planning/task-queue.md` (Sprint 73), `summaries/dev-history.md`, `checkpoints/session-log.md`,
`memory/project-decisions.md`, then `sync-context.md` → **`update-ai-system.md`** → clear this file.

---

## Risks / failsafes (explicit)

- **Corruption** → sha256 over exact line bytes + per-table content hashes + footer presence; partial writes stay `.part`.
- **Interrupted run** → journal stages + atomic state writes ⇒ resume from the next stage, never re-dump blindly.
- **Bad target write** → whole load is ONE transaction; verification runs *inside* it ⇒ failure = rollback, target byte-identical to before.
- **Clearing data** → target cleared only when empty, otherwise `--replace` + a safety backup of the target that must succeed first.
- **Silent TZ corruption** → raw-text time transport (codec) + dedicated regression test.
- **Credential leaks** → every log line redacts `user:pass@`.
- **Schema drift** → preflight diff; source column with no safe home in target ⇒ hard fail (no partial loads).

**Status:** plan written — awaiting go/no-go (see `question` tool call).
