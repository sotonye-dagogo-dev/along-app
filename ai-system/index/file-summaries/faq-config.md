# FAQ Config

**Path:** `app/lib/config/faq.ts`

**Purpose:** Defines the `FaqCategory` interface and `DEFAULT_FAQ_ITEMS` array with categorized Q&A pairs (Getting Started, Routes & Posts, Maps & Navigation, Offline & App, Trust & Rewards, Reviews [Sprint 25: how to leave/what happens next/where to read], Privacy & Safety). Used by the FAQ page and structured data schema generation. `FAQ_PCM` [Sprint 25] holds per-item Pidgin overrides keyed by item id, applied by FaqClient when locale is pcm (missing entries fall back to English — never raw keys).

**Key exports:** `FaqCategory` (type), `DEFAULT_FAQ_ITEMS`, `FAQ_PCM`
