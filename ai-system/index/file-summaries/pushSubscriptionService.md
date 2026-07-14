# Push Subscription Service

**Path:** `app/lib/services/pushSubscriptionService.ts`

**Purpose:** Database service for managing push notification subscriptions. Provides `subscribeUser` (upsert by userId+endpoint), `unsubscribeUser` (delete by userId+endpoint), and `getUserSubscriptions` (list by userId). Operates on the Prisma `PushSubscription` model.

**Key exports:** `subscribeUser`, `unsubscribeUser`, `getUserSubscriptions`
