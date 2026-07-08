# Test Plan

> **Metadata**
> - last-updated-by: bootstrap-project
> - last-verified-against-code: 2026-07-01
> - staleness-policy: re-verify if new features are added

> **Overview:** Defines what needs to be tested in Along and at what level. Agents reference this when writing tests or running the verify-work quality gate. Jest + React Testing Library are configured with coverage thresholds (branches 70%, functions 70%, lines 80%, statements 80%). 91 tests currently exist across 9 suites.

---

## Unit Tests

> **Section summary:** Tests for individual functions and modules in isolation.

- [x] Service layer methods (ValidityEngine — 12 tests, DraftingCoachService — 9 tests, RewardsService — 6 tests)
- [x] Config registry validation (navigation — 6 tests, avatar — 5 tests)
- [x] Utility functions (metadata — 7 tests)
- [x] Component tests (AppEmptyState — 12 tests, AppUserLabel — 7 tests, TrustBadge — 6 tests)
- [ ] BaseRepository<T> — CRUD operations, pagination, transaction handling
- [ ] Zod schema validation for all API routes
- [ ] JWT utility functions (sign, verify, decode)

---

## Integration Tests

> **Section summary:** Tests for how modules work together, including database operations and API routes.

- [ ] Auth API routes (register -> login -> refresh -> logout flow)
- [ ] Post CRUD (create, read, update, delete via API)
- [ ] Like/unlike toggle via API
- [ ] Comment creation and retrieval
- [ ] Bookmark save/remove flow
- [ ] Follow/unfollow user flow
- [ ] Search endpoint with filters and pagination
- [ ] Feed route with cursor-based pagination
- [ ] Notification creation and delivery
- [ ] Rate limiter integration

---

## Component Tests

> **Section summary:** Tests for UI components using React Testing Library.

- [x] AppEmptyState (12 tests — all presets, custom content, variants)
- [x] AppUserLabel (7 tests — name, handle, linkToProfile, verified badge, sizes, vertical layout)
- [x] TrustBadge (6 tests — all 4 levels, tooltip, sizes)
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
