import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildMetadata } from "@/app/lib/utils/metadata";

export const metadata = buildMetadata({
  title: "Terms of Service",
  description:
    "The terms governing your use of Along, including user responsibilities, content guidelines, and platform rules.",
  path: "/terms",
});

const content = `# Terms of Service

**Last updated: October 2026**

## Acceptance of Terms

By creating an account or using Along, you agree to these Terms of Service. If you do not agree, do not use the platform.

## User Responsibilities

- You must be at least 13 years old to use Along
- You are responsible for the accuracy of routes and information you share
- You may not use Along for any illegal or unauthorised purpose
- You must not attempt to manipulate trust scores or validity ratings

## Content Guidelines

When sharing routes on Along:

- Route information should be accurate and based on your personal experience
- Do not share false or misleading route information
- Respect the privacy of others - do not share personal information about other commuters
- Do not post spam, advertisements, or promotional content

## Trust Scores

Trust scores are calculated algorithmically based on community interactions, route detail, corroboration, and recency. Along reserves the right to adjust scores to maintain platform integrity.

## Travel Times & Traffic Estimates

Journey totals show as a range (free-flow time to with-traffic time) and per-stretch times always add up to those totals. Traffic overlays are estimates — keyless by default from typical conditions, live where optional provider keys are configured — and are cached on-device with periodic refresh. They are a guide, not a guarantee: always verify critical trips through official sources.

## Account Deletion

You may request deletion of your account from your profile. Requests enter a 7-day grace period during which your account is archived (posts hidden or anonymised) and you may reverse the request; after completion, personal information is deleted within 30 days while anonymised post data may be retained for platform integrity.

## Termination

We may suspend or terminate accounts that violate these terms, including accounts engaged in spam, fraud, or abuse of the trust system.

## Limitation of Liability

Along provides route information as a community service. Route accuracy is not guaranteed. Always verify critical route information through official sources. Along is not liable for losses arising from reliance on user-shared route information.

## Changes

We may update these terms. Continued use after changes constitutes acceptance of the new terms.

## Contact

Questions about these terms? Email alongtoanywhere@gmail.com.`;

export default function TermsPage() {
  return (
    <div className="max-w-[720px] mx-auto px-4 py-12">
      <div
        className="prose prose-sm max-w-none
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
