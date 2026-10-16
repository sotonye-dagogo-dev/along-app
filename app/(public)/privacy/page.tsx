import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildMetadata } from "@/app/lib/utils/metadata";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description: "How Along handles your data, privacy, and cookie usage. Learn about our commitment to protecting your information.",
  path: "/privacy",
});

const content = `# Privacy Policy

**Last updated: October 2026**

## Information We Collect

When you use Along, we collect information you provide directly, such as your name, email address, and profile information when you create an account.

We also collect information about your use of the platform, including routes you share, routes you interact with, and your preferences.

## Location Data

Along stores an optional last-known location per user (nullable, consent-based, used for the feed nearby boost). It is never sold, raw coordinates are never exposed to other members, and it is cleared if you delete your account. Route-request fan-out may attach a one-shot location (your cached fix if permission was already granted, otherwise the request's own start point) that is used only to compute that single fan-out — it is never saved, logged, or shown to anyone. Background location in the installed app is limited, so location-aware filtering is best-effort.

## Traffic & Map Data

Route maps may overlay traffic estimates on the route line. Traffic lookups send route coordinates and the base travel time only — no personal information — through our cached proxy, and results are cached on your device (refreshed about every 2 minutes while a map is open, hourly on the server) to stay rate-limit friendly.

## Offline & Device Storage

The installed app (PWA) keeps recently viewed pages, posts, routes, and map tiles in an on-device cache so they remain available offline. Cached data is labelled while offline — refresh when back online to stay updated. Clearing your browser or site data removes this cache.

## How We Use Your Information

We use your information to:

- Provide, maintain, and improve Along's route-sharing and discovery features
- Personalise your experience, including your feed and route suggestions
- Calculate trust scores and validity ratings for shared routes
- Send notifications about interactions with your posts
- Detect, investigate, and prevent fraudulent or abusive activity

## Data Sharing

We do not sell your personal information. We may share anonymised, aggregated data for research or product improvement purposes.

## Cookies

Along uses essential cookies to keep you signed in and maintain session state. We do not use third-party tracking cookies. By continuing to use Along, you consent to our use of essential cookies.

## Data Retention

We retain your account information for as long as your account is active. If you request account deletion, your account is archived for a 7-day grace period (reversible on request) before completion; we delete your personal information within 30 days of completion, though anonymised post data may be retained for platform integrity.

## Your Rights

You may access, update, or delete your account information at any time through your profile settings. Contact us at alongtoanywhere@gmail.com for privacy-related requests.

## Contact

For privacy questions, email alongtoanywhere@gmail.com.`;

export default function PrivacyPage() {
  return (
    <div className="max-w-[720px] mx-auto px-4 py-12">
      <div className="prose prose-sm max-w-none
        prose-headings:text-text-primary prose-headings:font-semibold
        prose-h1:text-2xl prose-h1:font-bold prose-h1:tracking-tight
        prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-8
        prose-p:text-text-primary prose-p:leading-relaxed
        prose-li:text-text-primary
        prose-strong:text-text-primary
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-ul:my-4
        prose-hr:border-border
      ">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
