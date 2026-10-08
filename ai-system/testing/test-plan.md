# Test Plan

> **Metadata**
> - last-updated-by: execute-feature 2026-10-08
> - last-verified-against-code: 2026-10-08 (13 test files under app/__tests__/, 139 tests by real jest run incl. search API + searchService suites; jest.config.js thresholds branches 70 / functions 70 / lines 80 / statements 80)
> - staleness-policy: re-verify if new features are added

> **Overview:** Defines what needs to be tested in Along and at what level. Agents reference this when writing tests or running the verify-work quality gate. Jest + React Testing Library are configured with coverage thresholds (branches 70%, functions 70%, lines 80%, statements 80%). 139 tests currently exist across 13 suites (verified by real `npx jest` run 2026-10-08, search feature session).

---

## Unit Tests

> **Section summary:** Tests for individual functions and modules in isolation. Counts verified 2026-10-08.

- [x] Service layer methods (ValidityEngine — 12 tests, DraftingCoachService — 13 tests, RewardsService — 7 tests)
- [x] Config registry validation (navigation — 6 tests, avatar — 9 tests)
- [x] Utility functions (metadata — 9 tests)
- [x] Component tests (AppEmptyState — 17 tests, AppUserLabel — 10 tests, TrustBadge — 8 tests)
- [ ] BaseRepository<T> — CRUD operations, pagination, transaction handling
- [ ] Zod schema validation for all API routes
- [ ] JWT utility functions (sign, verify, decode)

---

## Integration Tests

> **Section summary:** Tests for how modules work together, including database operations and API routes. API-boundary suites below mock Prisma (`jest.mock prisma`) — they prove route logic, not live DB writes.

- [x] Post CRUD at API boundary — create → 201, validation, quote rules, list/filters/pagination envelope (`app/__tests__/api/posts.test.ts`, 11 tests, Prisma mocked)
- [x] Like/unlike toggle via API boundary (`mutations.test.ts` — like section, Prisma mocked)
- [x] Comment creation and retrieval via API boundary (`mutations.test.ts` — comment section, Prisma mocked)
- [x] Bookmark save/remove flow via API boundary (`mutations.test.ts` — bookmark section, Prisma mocked)
- [x] Follow/unfollow user flow via API boundary (`mutations.test.ts` — follow section, Prisma mocked)
- [ ] Auth API routes against live DB (register -> login -> refresh -> logout flow)
- [ ] Post CRUD against live DB (create, read, update, delete via API)
- [x] Search endpoint with filters and pagination at API boundary (`app/__tests__/api/search.test.ts`, 9 tests: validation, type filters, region/postType, 503, 429; Prisma mocked) + service unit tests (`app/__tests__/services/searchService.test.ts`, 8 tests; implemented 2026-10-08 — live-DB run still open)
- [ ] Feed route with cursor-based pagination against live DB
- [ ] Notification creation and delivery end-to-end (fan-out covered at API boundary in posts.test.ts only)
- [ ] Rate limiter integration

---

## Component Tests

> **Section summary:** Tests for UI components using React Testing Library. Counts verified 2026-10-08.

- [x] AppEmptyState (17 tests — all presets, custom content, variants)
- [x] AppUserLabel (10 tests — name, handle, linkToProfile, verified badge, sizes, vertical layout)
- [x] TrustBadge (8 tests — all 4 levels, tooltip, sizes)
- [ ] AppButton (variants, loading state, disabled, click handler)
- [ ] AppCard (rendering children, title, loading skeleton)
- [ ] AppInput (value changes, error state, disabled)
- [ ] AppModal (open/close, confirm/cancel handlers)
- [ ] PostCard (renders post content, like/bookmark actions)
- [ ] GlobalConfirmModal (confirmation flow)

---

## End-to-End Tests

> **Section summary:** Tests that simulate real user journeys through the system.

- [ ] User registration -> login -> create post -> view in feed
- [ ] Search for route -> view on map -> bookmark
- [ ] Follow user -> receive notification -> view notification
- [ ] Admin login -> view dashboard -> moderate content

---

## Performance Tests

> **Section summary:** Tests to verify the system performs acceptably under expected load.

- [ ] API response time under normal load (< 200ms for cached, < 500ms for uncached)
- [ ] Feed pagination performance with large datasets
- [ ] Map clustering performance with 1000+ markers
- [ ] Lighthouse audit for page load performance
- [ ] Bundle size analysis (main.js, Ant Design tree-shaking)
