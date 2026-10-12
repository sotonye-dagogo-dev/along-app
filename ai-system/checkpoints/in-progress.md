# In progress — none

No active work. Last session (2026-10-12, execute-feature Sprint 49:
installed-PWA update lifecycle — periodic checks + user-approved
single-reload prompt) is closed: `PWA_UPDATE_CONFIG` + `PWA_SW_MESSAGES` +
cache v4→v5, `sw.js` no-auto-skipWaiting + broadcasts, rewritten
`ServiceWorkerRegistrar`, NEW `ServiceWorkerUpdatePrompt` in `PwaNotices`,
`pwa.update*` en/pcm keys, FAQ `app-updates` (+pcm), `pwa.test.ts` +2,
`locales.test.ts` +4 keys. QA to runner extent (node --check sw.js +
JSON/parity green; full tsc/jest/build deferred to CI — no node_modules).
