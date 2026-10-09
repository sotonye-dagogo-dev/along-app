# Reviews API

**Path:** `app/api/reviews/route.ts` (Sprint 25)

**Purpose:** Public platform-reviews endpoint backing the About carousel, profile Reviews tabs, and ReviewsPanel. Storage reuses `UserReview` with the self-pair marker (`reviewerId === revieweeId === authorId`, see `REVIEWS_CONFIG`) — one platform review per user via the existing `@@unique`, no migration.

**Contract:** `GET ?limit=&cursor=&mine=&authorId=` → `{ reviews: PlatformReviewItem[], nextCursor }` (APPROVED only; own PENDING included when `mine=1` + authed; edge-cached 60s, SW-cacheable). `POST { rating: 1–5, comment? }` (auth, `reviews` rate-limit bucket) → upsert ACID (re-submit updates + re-pends) + fire-and-forget `notifyReviewThanks` (REWARD+allowSelf, no email). Errors sanitized + offline-aware (never Prisma internals).

**Key consumers:** `AboutPageClient` (tape + CTA cadence), `ReviewsPanel` (form/list), `app/api/admin/reviews` (moderation unchanged).
