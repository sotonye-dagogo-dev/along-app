**Session:** execute-feature 2026-10-09 (Sprint 27) — admin verify actions + push-prompt event handling + OTP verify-email feedback.
**Status:** Implementation complete. QA static-level in-runner (no node_modules — tsc/jest/build deferred to CI/Vercel, as with Sprint 26).

## Plan (Step 1)

Root causes found:
- OTP "invalid/expired immediately": `otp:{email}` single key shared by register/resend/verify-email (resend invalidates older codes silently); serverless memory-fallback non-durable across instances; resend UI fire-and-forget (`.catch(()=>{})`, fixed 45s timer) vs shared auth bucket (10/15min) → repeat sends 429'd invisibly ("wasn't sent any"); send failures still returned success ("OTP resent") so users waited for mail that never came; masked email hardcoded `t***@example.com`.
- Push Enable dead: `subscribeToPush()` never requested `Notification` permission and swallowed every failure as `false` — button spun then went silent, prompt stayed. No local persistence (dismissal lost on reload, server `/api/push/status` unreachable offline). No env guards (iOS/secure-context/unsupported).
- Admin: PATCH only handled role(+verified flag) — no verify/unverify/resend-code actions, no user notification.

## Changes

- NEW `app/lib/config/authVerification.ts` (+ barrel): TTL 900s, cooldown 60s, 5 attempts, key prefixes, user-facing copy, `maskEmail`/`cooldownKeyFor`/`attemptsKeyFor`.
- `otpStore.ts` (+additive): `setSendCooldown`/`getSendCooldownRemaining`, `recordVerifyAttempt`/`clearVerifyAttempts` (same Redis-timeout+memory pattern).
- `otp/resend`, `verify-email` POST: per-email cooldown (429+`retryAfter`), honest `{sent, expiresIn, cooldown, invalidatesPrevious}` payloads; verify PUT + `otp` POST: attempt counter w/ revoke-at-5, `expired`/`attemptsLeft` flags, contextual copy; PUT newly rate-limited.
- Register: seeds cooldown at issuance, returns `{expiresIn, cooldown}`; register page forwards `?cooldown=` to OTP screen; OTP screen rewritten (real masked email, expiry/newest-only notes, server-driven timer, delivery-failure + 429 surfacing).
- NEW `useOtpResend` hook shared by OTP screen + `EmailSecurityPanel` (server-timer adoption, offline-safe, never throws).
- NEW `app/lib/config/pushPrompt.ts` (+ barrel): storage keys, 7-day dismiss TTL, per-outcome copy, `isLikelyIos`.
- `pushClient.ts`: `getPushSupport()` env guards, `ensurePushPermission()` in-gesture request, `subscribeToPushDetailed()` stable reasons; boolean wrapper kept.
- `PushManager.tsx`: local enabled/dismissed flags, per-outcome inline guidance (+iOS help), toasts, retry; `PushProvider`: granted-only auto-subscribe, env-guarded.
- Admin `PATCH /api/admin/users`: `verify`/`unverify` (notifies user, undo snapshot) + `resend-verification` (fresh OTP + honest emailed/errors counts); users page: Email-status column, Verify/Unverify/Resend-code row actions, bulk Verify, undo support.
- Locales en/pcm +15 keys each (250/250 parity verified in-runner); NEW `authVerificationPush.test.ts` (6 suites).

## QA

- node strip-types: configs execute (TTL 15, mask, keys, iOS detect) ✅
- locale parity script: 250/250 identical ✅
- tsc / jest / next build: DEFERRED (no node_modules in runner — CI/Vercel must confirm green)
