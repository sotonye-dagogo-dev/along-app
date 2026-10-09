# In progress — fix-build 2026-10-09 (verify-email 404 + fresh OTP "expired")

**Error:** (1) `/verify-email?email=…` links from verification mails → "Page
not found" (route never existed). (2) Just-received OTP returns "That code
expired or was replaced by a newer one" with no newer code requested.

**Diagnosis:** missing page + volatile Redis/memory-only `otp:{email}` store
(non-durable across serverless instances — same class as the reset-link fix
via `PasswordResetToken`). `change-email` confirm shared the hole, plus no
cooldown/attempt-cap/PUT-rate-limit.

**Plan:** durable `EmailOtpToken` model + migration + `emailOtpStore`
service; wire issuance (register/resend/verify-email/change-email/admin
resend) + verification fallbacks (`otp` POST, verify-email PUT,
change-email PUT); new `app/(public)/verify-email/page.tsx` + middleware
guest route; preview/sample link accuracy; tests
(`emailOtpStore.test.ts`, `verifyEmailFlow.test.ts`).

**Files touched:** `app/(public)/verify-email/page.tsx` (new),
`middleware.ts`, `prisma/schema.prisma`,
`prisma/migrations/20261009000002_email_otp_token/` (new),
`app/lib/services/emailOtpStore.ts` (new), `app/api/auth/{register,otp,otp/resend,verify-email,change-email}/route.ts`,
`app/api/admin/users/route.ts`, `app/api/email/preview/route.ts`,
`app/admin/email/page.tsx`, `app/lib/config/emailManagement.ts`, 2 new
test files. No removed APIs; response shapes extended additively only.

**Verify:** runner has no node_modules — global-`tsc` parse check shows zero
attributable errors (only missing-dep `TS2307`/node-global noise, also
present on untouched files); full jest/tsc/build deferred to CI/Vercel
(`prisma generate` + `migrate deploy` run before build, so the new model
resolves). See `checkpoints/session-log.md` (Session 2026-10-09 —
Verify-email 404 + fresh-OTP fix-build), `repair-system.md` (new entry),
`testing/test-results.md` (history row).
