import type { Metadata } from "next";
import { DEFAULT_META } from "@/app/lib/config";

type BuildMetaOptions = {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  noIndex?: boolean;
  /** OpenGraph type — defaults to website (article for blogs). */
  ogType?: "website" | "article" | "profile" | "book";
  publishedTime?: string;
  authorName?: string;
};

export function buildMetadata({
  title,
  description,
  path,
  ogImage,
  noIndex = false,
  ogType = "website",
  publishedTime,
  authorName,
}: BuildMetaOptions): Metadata {
  const url = `${DEFAULT_META.url}${path}`;
  const image = ogImage ?? DEFAULT_META.ogImage;

  // Article/profile extras are spread conditionally and cast to the
  // OpenGraph union (website has no authors/publishedTime fields) so the
  // shared builder stays callable for every page type without casts at
  // call sites.
  const openGraph = {
    title: `${title}${DEFAULT_META.titleSuffix}`,
    description,
    url,
    siteName: DEFAULT_META.siteName,
    images: [{ url: image, width: 1200, height: 630 }],
    type: ogType,
    ...(publishedTime ? { publishedTime } : {}),
    ...(authorName ? { authors: [authorName] } : {}),
  } as Metadata["openGraph"];

  return {
    metadataBase: new URL(DEFAULT_META.url),
    // Bare title: the root layout title.template appends ` | Along` once.
    title,
    description,
    alternates: { canonical: url },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: `${title}${DEFAULT_META.titleSuffix}`,
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
    // Bare title — the root layout title.template appends ` | Along` once.
    title,
    description,
    alternates: { canonical: `${DEFAULT_META.url}${path}` },
    openGraph: {
      title: `${title}${DEFAULT_META.titleSuffix}`,
      description,
      url: `${DEFAULT_META.url}${path}`,
      siteName: DEFAULT_META.siteName,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "article",
      publishedTime: post.createdAt.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title}${DEFAULT_META.titleSuffix}`,
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
    // Bare title — the root layout title.template appends ` | Along` once.
    title: `${displayName} (@${profile.userName})`,
    description,
    alternates: { canonical: `${DEFAULT_META.url}${path}` },
    openGraph: {
      title: `${displayName} (@${profile.userName})${DEFAULT_META.titleSuffix}`,
      description,
      url: `${DEFAULT_META.url}${path}`,
      siteName: DEFAULT_META.siteName,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "profile",
      username: profile.userName,
    },
    twitter: {
      card: "summary_large_image",
      title: `${displayName} (@${profile.userName})${DEFAULT_META.titleSuffix}`,
      description,
      images: [ogImage],
    },
  };
}
