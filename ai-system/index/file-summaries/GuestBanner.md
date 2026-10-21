# GuestBanner

**Path:** `app/components/ui/GuestBanner.tsx`

**Purpose:** 'use client' banner shown to unauthenticated users, prompting the platform tour or sign-in/registration. Gradient background; responsive three-CTA layout (Take tour, Sign In, Sign Up) wraps and grows each CTA to fill narrow rows (`flex-auto`, `sm:flex-none` restores the desktop row) so there is no right-side dead space [Sprint 87; Sprint 88 spacing]. Hidden when an offline auth snapshot exists.

**Key exports:** `GuestBanner` (default)
