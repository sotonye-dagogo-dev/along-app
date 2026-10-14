import { MEDIA_CLEANUP_CONFIG } from "@/app/lib/config/mediaCleanup";
import { filterUnreferencedUrls } from "@/app/lib/services/mediaCleanupService";
import {
  diffRemovedUrls,
  extractPublicId,
  filterCleanableUrls,
  isAllowedPublicId,
  isCloudinaryUrl,
} from "@/app/lib/utils/cloudinaryUrls";

const POST_URL =
  "https://res.cloudinary.com/demo/image/upload/v1710000000/along/posts/abc123.jpg";
const POST_URL_2 =
  "https://res.cloudinary.com/demo/image/upload/v1710000001/along/posts/def456.webp";
const OUTSIDE_URL =
  "https://res.cloudinary.com/demo/image/upload/v1710000000/other/folder/xyz.jpg";
const NON_CLOUDINARY = "https://example.com/images/pic.jpg";

describe("media cleanup: config-driven orphan prevention", () => {
  it("config carries allowlist + per-flow toggles + account-retention policy", () => {
    expect(MEDIA_CLEANUP_CONFIG.allowedFolderPrefixes).toContain("along/posts");
    expect(MEDIA_CLEANUP_CONFIG.postDeleteCleanupEnabled).toBe(true);
    expect(MEDIA_CLEANUP_CONFIG.postEditCleanupEnabled).toBe(true);
    expect(MEDIA_CLEANUP_CONFIG.draftCleanupEnabled).toBe(true);
    expect(MEDIA_CLEANUP_CONFIG.composerRemoveCleanupEnabled).toBe(true);
    expect(MEDIA_CLEANUP_CONFIG.moderationDeleteCleanupEnabled).toBe(true);
    // Policy: anonymised post images are retained on account finalize.
    expect(MEDIA_CLEANUP_CONFIG.retainPostImagesOnAccountFinalize).toBe(true);
    expect(MEDIA_CLEANUP_CONFIG.cleanupAvatarOnAccountFinalize).toBe(true);
    // Cross-post guard: on by default (kill-switch via MEDIA_CLEANUP_GUARD_REFS).
    expect(MEDIA_CLEANUP_CONFIG.guardLivePostReferences).toBe(true);
    expect(MEDIA_CLEANUP_CONFIG.maxUrlsPerCall).toBeGreaterThan(0);
  });

  it("detects Cloudinary hosts and rejects anything else", () => {
    expect(isCloudinaryUrl(POST_URL)).toBe(true);
    expect(isCloudinaryUrl(NON_CLOUDINARY)).toBe(false);
    expect(isCloudinaryUrl("not-a-url")).toBe(false);
    expect(isCloudinaryUrl(null)).toBe(false);
  });

  it("extracts public_id without version or extension", () => {
    expect(extractPublicId(POST_URL)).toBe("along/posts/abc123");
    expect(extractPublicId(`${POST_URL_2}?x=1`)).toBe("along/posts/def456");
    expect(extractPublicId(NON_CLOUDINARY)).toBeNull();
  });

  it("enforces the folder allowlist (along/* only)", () => {
    expect(isAllowedPublicId("along/posts/abc", ["along/posts"])).toBe(true);
    expect(isAllowedPublicId("other/folder/xyz", ["along/posts"])).toBe(false);
    const kept = filterCleanableUrls(
      [POST_URL, OUTSIDE_URL, NON_CLOUDINARY],
      ["along/posts"]
    );
    expect(kept).toEqual([POST_URL]);
  });

  it("diffs removed images for the post-edit path", () => {
    expect(diffRemovedUrls([POST_URL, POST_URL_2], [POST_URL_2])).toEqual([POST_URL]);
    expect(diffRemovedUrls([POST_URL], [POST_URL])).toEqual([]);
    expect(diffRemovedUrls("nope", [POST_URL])).toEqual([]);
  });

  it("cross-post guard keeps a URL still referenced by another live post", async () => {
    // Regression: editing/deleting post A must never destroy an asset that
    // live post B still renders (shared secure_url via draft restore/repost).
    const referenced = new Set([POST_URL]);
    const { unreferenced, skippedReferenced } = await filterUnreferencedUrls(
      [POST_URL, POST_URL_2],
      {
        findPostByImage: async (url: string) => (referenced.has(url) ? { id: "post-b" } : null),
        getBlogImageSet: async () => new Set<string>(),
      }
    );
    expect(unreferenced).toEqual([POST_URL_2]);
    expect(skippedReferenced).toBe(1);
  });

  it("cross-post guard fails OPEN on DB hiccups (keeps the asset)", async () => {
    const { unreferenced, skippedReferenced } = await filterUnreferencedUrls(
      [POST_URL],
      {
        findPostByImage: async () => {
          throw new Error("db down");
        },
        getBlogImageSet: async () => new Set<string>(),
      }
    );
    expect(unreferenced).toEqual([]);
    expect(skippedReferenced).toBe(1);
  });

  it("cross-post guard keeps blog-referenced URLs", async () => {
    const { unreferenced, skippedReferenced } = await filterUnreferencedUrls(
      [POST_URL],
      {
        findPostByImage: async () => null,
        getBlogImageSet: async () => new Set([POST_URL]),
      }
    );
    expect(unreferenced).toEqual([]);
    expect(skippedReferenced).toBe(1);
  });

  it("cross-post guard returns empty for empty input without touching deps", async () => {
    let calls = 0;
    const res = await filterUnreferencedUrls([], {
      findPostByImage: async () => {
        calls += 1;
        return { id: "x" };
      },
    });
    expect(res).toEqual({ unreferenced: [], skippedReferenced: 0 });
    expect(calls).toBe(0);
  });
});
