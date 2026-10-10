import { MEDIA_CLEANUP_CONFIG } from "@/app/lib/config/mediaCleanup";
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
    expect(MEDIA_CLEANUP_CONFIG.moderationDeleteCleanupEnabled).toBe(true);
    // Policy: anonymised post images are retained on account finalize.
    expect(MEDIA_CLEANUP_CONFIG.retainPostImagesOnAccountFinalize).toBe(true);
    expect(MEDIA_CLEANUP_CONFIG.cleanupAvatarOnAccountFinalize).toBe(true);
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
});
