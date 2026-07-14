# Push Client

**Path:** `app/lib/utils/pushClient.ts`

**Purpose:** Client-side utility for browser push subscription. Fetches the VAPID public key from `/api/push/vapid-public-key`, registers the service worker (`/sw.js`), and subscribes via `PushManager`. Sends the subscription to `/api/push/subscribe`. Converts base64 VAPID key to Uint8Array.

**Key exports:** `getVapidPublicKey`, `registerServiceWorker`, `subscribeToPush`
