# siteConfig Utility

**Path:** `app/lib/utils/siteConfig.ts`

**Purpose:** Server-side utility for reading dynamic site configuration from the database. Uses a read-through cache pattern: checks Redis first, falls back to Prisma (`SiteConfig` model), then to provided default. Cache keys follow `CACHE_KEYS.siteConfig`.

**Key exports:** `getSiteConfig<T>(key, defaultValue)`
