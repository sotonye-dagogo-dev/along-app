import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Turbopack fallback uses webpack for compatibility
  // NOTE: the '$' suffix is an exact-match alias — a plain 'maplibre-gl' key
  // prefix-matches and rewrites subpath imports such as
  // 'maplibre-gl/dist/maplibre-gl.css' (used by explore page + RouteMap for
  // marker positioning) into an unresolvable path, failing the Vercel build
  // with "Module not found: Can't resolve 'maplibre-gl/dist/maplibre-gl.css'".
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'maplibre-gl$': 'maplibre-gl/dist/maplibre-gl.js',
    };
    return config;
  },
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  // Performance & PWA headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(), microphone=()",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },

      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },

      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
    ];
  },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryDsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
// Fully configured only when the CLI has everything it needs (token + org +
// project + DSN). A present-but-invalid token still attempts API calls, so
// release/sourcemap work stays gated here and any residual failure is
// swallowed by errorHandler below — Sentry must never fail the build.
const sentryConfigured = Boolean(sentryAuthToken && sentryOrg && sentryProject && sentryDsn);

export default withSentryConfig(nextConfig, {
    org: sentryOrg,
    project: sentryProject,
    authToken: sentryAuthToken,
    dryRun: !sentryConfigured, // Skip Sentry operations when unconfigured
    silent: true, // Keep Vercel logs clean (CI sets CI=true, so conditional silence never applied there)
    telemetry: false, // Opt out of Sentry plugin telemetry (removes per-runtime Info noise)
    // Never fail the build on Sentry connectivity/auth issues (e.g. 401
    // invalid token). Log once as a warning so the token can be rotated.
    errorHandler: (err) => {
        console.warn("[sentry] build-time operation skipped:", err?.message ?? err);
    },
    release: {
        create: sentryConfigured,
        finalize: sentryConfigured,
    },
    sourcemaps: {
        disable: !sentryConfigured,
    },
    widenClientFileUpload: true,
    hideSourceMaps: true,
    webpack: {
        treeshake: {
            removeDebugLogging: true,
        },
        automaticVercelMonitors: false,
    },
});
