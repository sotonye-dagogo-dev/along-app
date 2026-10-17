/**
 * Sentry client-side instrumentation.
 * Tree-shaken out of the production bundle when NEXT_PUBLIC_SENTRY_DSN is unset.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? "development",
        release: process.env.NEXT_PUBLIC_APP_VERSION,

        // Performance monitoring — capture 10 % of traces in production
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

        // Session replay — 2 % of sessions (was 10 %), 100 % on error.
        // Lowered to cut envelope volume during deploys (ingest 429s).
        replaysSessionSampleRate: 0.02,
        replaysOnErrorSampleRate: 1.0,

        integrations: [Sentry.replayIntegration()],

        // Silence noisy browser extension errors
        ignoreErrors: [
            "ResizeObserver loop limit exceeded",
            "ResizeObserver loop completed with undelivered notifications",
        ],
    });
}
