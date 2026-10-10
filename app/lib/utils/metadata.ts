import type { Metadata } from "next";
import { DEFAULT_META } from "@/app/lib/config";

type BuildMetaOptions = {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  noIndex?: boolean;
};

export function buildMetadata({
  title,
  description,
  path,
  ogImage,
  noIndex = false,
}: BuildMetaOptions): Metadata {
  const url = `${DEFAULT_META.url}${path}`;
  const image = ogImage ?? DEFAULT_META.ogImage;

  return {
    metadataBase: new URL(DEFAULT_META.url),
    title: `${title} | Along`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | Along`,
      description,
      url,
      siteName: DEFAULT_META.siteName,
      images: [{ url: image, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Along`,
      description,
      images: [image],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export function buildPublicMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return buildMetadata({ title, description, path });
}

/**
 * Resolve an OG image to an absolute-or-root-relative value with a safe
 * fallback to the default og-image. Relative paths ("/uploads/...") are kept
 * as-is — Next resolves them against metadataBase. Absolute http(s) URLs pass
 * through. Anything else falls back to the default.
 */
export function resolveOgImage(candidate: unknown): string {
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (
      trimmed.length > 0 &&
      (trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed))
    ) {
      return trimmed;
    }
  }
  return DEFAULT_META.ogImage;
}

export async function buildPostMetadata(
  post: {
    title: string;
    description?: string | null;
    createdAt: Date;
    type?: string | null;
    images?: (string | null | undefined)[] | null;
    user?: { firstName: string; userName: string } | null;
  } | null,
  path: string,
): Promise<Metadata> {
  if (!post) {
    return buildMetadata({
      title: "Post Not Found",
      description: "This post could not be found.",
      path,
      noIndex: true,
    });
  }

  const title = post.title;
  const isRequest = post.type === "ROUTE_REQUEST";
  const rawDescription =
    typeof post.description === "string" && post.description.trim().length > 0
      ? post.description.trim().slice(0, 160)
      : null;
  const description =
    rawDescription ??
    (isRequest
      ? `Route request by ${post.user?.firstName ?? "a traveler"} - ${post.title}`
      : `Route shared by ${post.user?.firstName ?? "a traveler"} - ${post.title}`);
  // First post image wins (map snapshot / upload); default og-image fallback.
  const firstImage = Array.isArray(post.images)
    ? post.images.find(
        (img): img is string =>
          typeof img === "string" && img.trim().length > 0,
      )
    : undefined;
  const ogImage = resolveOgImage(firstImage);

  return {
    title: `${title} | Along`,
    description,
    alternates: { canonical: `${DEFAULT_META.url}${path}` },
    openGraph: {
      title: `${title} | Along`,
      description,
      url: `${DEFAULT_META.url}${path}`,
      siteName: DEFAULT_META.siteName,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "article",
      publishedTime: post.createdAt.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Along`,
      description,
      images: [ogImage],
    },
  };
}

export async function buildProfileMetadata(
  profile: {
    firstName: string;
    lastName: string;
    userName: string;
    bio?: string | null;
    avatar?: string | null;
  } | null,
  path: string,
): Promise<Metadata> {
  if (!profile) {
    return buildMetadata({
      title: "User Not Found",
      description: "This profile could not be found.",
      path,
      noIndex: true,
    });
  }

  const displayName = `${profile.firstName} ${profile.lastName}`;
  const rawBio =
    typeof profile.bio === "string" && profile.bio.trim().length > 0
      ? profile.bio.trim().slice(0, 160)
      : null;
  const description =
    rawBio ??
    `${displayName} (@${profile.userName}) on Along. View their shared routes and community reputation.`;
  // Avatar wins for profile shares; default og-image fallback.
  const ogImage = resolveOgImage(profile.avatar);

  return {
    title: `${displayName} (@${profile.userName}) | Along`,
    description,
    alternates: { canonical: `${DEFAULT_META.url}${path}` },
    openGraph: {
      title: `${displayName} (@${profile.userName}) | Along`,
      description,
      url: `${DEFAULT_META.url}${path}`,
      siteName: DEFAULT_META.siteName,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "profile",
      username: profile.userName,
    },
    twitter: {
      card: "summary_large_image",
      title: `${displayName} (@${profile.userName}) | Along`,
      description,
      images: [ogImage],
    },
  };
}
