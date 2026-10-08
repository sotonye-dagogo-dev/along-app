/**
 * Client-side Sentry entry point for Next.js Turbopack builds.
 *
 * `@sentry/nextjs` deprecates `sentry.client.config.ts` under Turbopack in
 * favour of this file (see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client).
 * The existing `sentry.client.config.ts` is kept as the single source of
 * truth for webpack builds; this module pulls it in by side-effect import so
 * both runtimes share one init with zero duplication.
 */
import "./sentry.client.config";
