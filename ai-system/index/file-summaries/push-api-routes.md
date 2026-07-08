# Push API Routes

**Path:** `app/api/push/*`

**Purpose:** REST API endpoints for push notification management:
- `subscribe/` — POST: Creates a push subscription (auth required), validates input
- `unsubscribe/` — POST: Removes a push subscription (auth required)
- `send/` — POST: Sends push notifications via web-push, triggered by QStash (validates QStash token). Cleans up expired (410) subscriptions automatically
- `vapid-public-key/` — GET: Exposes the VAPID public key to clients

**Key exports:** Route handler functions per endpoint
