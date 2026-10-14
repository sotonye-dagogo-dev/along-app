"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { shareBlogLink, buildBlogUrl } from "@/app/lib/services/blogShareService";
import { BLOG_SHARE_CONFIG } from "@/app/lib/config/blogManagement";
import { toastService } from "@/app/lib/services/toastService";
import ShareNetworkIcon from "@/app/components/features/blog/ShareNetworkIcon";

/**
 * BlogShareButtons — share affordance for blog surfaces (detail header +
 * listing cards). Native sheet first, clipboard fallback, network links as
 * progressive enhancement. Never throws; toasts are config-driven.
 */
export default function BlogShareButtons({ slug, title, compact = false }: { slug: string; title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const outcome = await shareBlogLink(slug, title || BLOG_SHARE_CONFIG.shareTitleDefault);
    if (outcome.ok) {
      if (outcome.method !== "web-share") {
        setCopied(true);
        toastService.success(BLOG_SHARE_CONFIG.copiedMessage);
        window.setTimeout(() => setCopied(false), 2500);
      }
    } else {
      toastService.error(BLOG_SHARE_CONFIG.copyError);
    }
  };

  const absoluteUrl =
    typeof window !== "undefined" ? buildBlogUrl(slug, window.location.origin) : buildBlogUrl(slug);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleShare}
        aria-label={`${BLOG_SHARE_CONFIG.shareLabel}: ${title}`}
        title={BLOG_SHARE_CONFIG.shareLabel}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 radius-md border border-border bg-bg-card text-xs font-semibold text-text-secondary hover:text-primary cursor-pointer transition-colors"
      >
        {copied ? <Check size={14} /> : <Share2 size={14} />}
        {!compact && BLOG_SHARE_CONFIG.shareLabel}
      </button>
      {!compact && (
        <span className="hidden sm:inline-flex items-center gap-1">
          {BLOG_SHARE_CONFIG.networks.map((n) => (
            <a
              key={n.id}
              href={n.href(absoluteUrl, title)}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`Share on ${n.label}`}
              title={`Share on ${n.label}`}
              className="p-1.5 radius-md border border-border text-text-muted hover:text-primary transition-colors"
            >
              <ShareNetworkIcon icon={n.icon} size={13} />
            </a>
          ))}
        </span>
      )}
    </div>
  );
}
