# OnlineStatusProvider

**Path:** `app/providers/OnlineStatusProvider.tsx`

**Purpose:** 'use client' context provider that tracks `navigator.onLine` state via `online`/`offline` events. On reconnect, automatically flushes the `offlineQueue` to replay queued mutations.

**Key exports:** `OnlineStatusProvider`, `useOnlineStatus`
