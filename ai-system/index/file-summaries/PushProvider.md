# PushProvider

**Path:** `app/providers/PushProvider.tsx`

**Purpose:** 'use client' context-aware provider that auto-subscribes authenticated users to push notifications on mount. Reads `AuthContext` to detect auth state and calls `subscribeToPush` from `pushClient`. Handles re-subscription on auth change.

**Key exports:** `PushProvider`
