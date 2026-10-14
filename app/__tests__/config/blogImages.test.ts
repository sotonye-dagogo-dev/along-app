import {
  BLOG_IMAGE_CONFIG,
  BLOG_MANAGEMENT_CONFIG,
  blogMaxSizeLabel,
} from "@/app/lib/config/blogManagement";
import {
  resolveBlogImageUrl,
  hasCustomBlogImage,
  extractBlogInlineImageUrls,
  collectBlogPostImageUrls,
  diffRemovedBlogUrls,
} from "@/app/lib/utils/blogImages";
import { MEDIA_CLEANUP_CONFIG } from "@/app/lib/config/mediaCleanup";

describe("blog image uploads + cleanup (directive)", () => {
  it("BLOG_IMAGE_CONFIG is env-sane and disjoint from posts/reports", () => {
    expect(BLOG_IMAGE_CONFIG.folder).toBe("along/blog");
    expect(BLOG_IMAGE_CONFIG.uploadFolderKey).toBe("blog");
    expect(BLOG_IMAGE_CONFIG.maxBytesPerImage).toBeGreaterThan(0);
    expect(BLOG_IMAGE_CONFIG.maxInlineImages).toBeGreaterThan(0);
    expect(BLOG_IMAGE_CONFIG.allowedTypes).toContain("image/jpeg");
    expect(BLOG_IMAGE_CONFIG.copy.coverAddLabel).toBeTruthy();
    expect(blogMaxSizeLabel()).toMatch(/MB/);
  });

  it("cleanup allowlist covers the blog folder", () => {
    expect(MEDIA_CLEANUP_CONFIG.allowedFolderPrefixes).toContain("along/blog");
  });

  it("resolveBlogImageUrl passes safe URLs, falls back otherwise", () => {
    expect(resolveBlogImageUrl("https://res.cloudinary.com/demo/image/upload/along/blog/a.jpg")).toContain("along/blog");
    expect(resolveBlogImageUrl("/og-image.png")).toBe("/og-image.png");
    expect(resolveBlogImageUrl("https://example.com/x.png")).toBe("https://example.com/x.png");
    expect(resolveBlogImageUrl("")).toBe(BLOG_MANAGEMENT_CONFIG.defaultImage);
    expect(resolveBlogImageUrl(null)).toBe(BLOG_MANAGEMENT_CONFIG.defaultImage);
    expect(resolveBlogImageUrl("javascript:alert(1)")).toBe(BLOG_MANAGEMENT_CONFIG.defaultImage);
    expect(resolveBlogImageUrl("data:image/png;base64,aaa")).toBe(BLOG_MANAGEMENT_CONFIG.defaultImage);
    expect(resolveBlogImageUrl("not a url with spaces !!")).toBe(BLOG_MANAGEMENT_CONFIG.defaultImage);
  });

  it("hasCustomBlogImage distinguishes default from custom", () => {
    expect(hasCustomBlogImage(BLOG_MANAGEMENT_CONFIG.defaultImage)).toBe(false);
    expect(hasCustomBlogImage("")).toBe(false);
    expect(hasCustomBlogImage("https://res.cloudinary.com/demo/image/upload/along/blog/a.jpg")).toBe(true);
  });

  it("extractBlogInlineImageUrls pulls <img src> only (safe, deduped, default excluded)", () => {
    const html =
      '<p>Hi</p><div><img src="https://res.cloudinary.com/demo/image/upload/along/blog/a.jpg" alt="A" /></div>' +
      "<p><img src='/og-image.png' /></p>" +
      '<img src="javascript:alert(1)">' +
      '<img src="https://res.cloudinary.com/demo/image/upload/along/blog/a.jpg">';
    const urls = extractBlogInlineImageUrls(html);
    expect(urls).toEqual(["https://res.cloudinary.com/demo/image/upload/along/blog/a.jpg"]);
    expect(extractBlogInlineImageUrls("")).toEqual([]);
    expect(extractBlogInlineImageUrls(null)).toEqual([]);
  });

  it("collectBlogPostImageUrls merges cover + inline without dupes", () => {
    const cover = "https://res.cloudinary.com/demo/image/upload/along/blog/cover.jpg";
    const inline = "https://res.cloudinary.com/demo/image/upload/along/blog/in.jpg";
    const got = collectBlogPostImageUrls({
      image: cover,
      content: `<p>x</p><img src="${inline}"><img src="${cover}">`,
    });
    expect(got).toContain(cover);
    expect(got).toContain(inline);
    expect(got.length).toBe(2);
    // Default cover contributes nothing.
    expect(collectBlogPostImageUrls({ image: "/og-image.png", content: "<p>no imgs</p>" })).toEqual([]);
    expect(collectBlogPostImageUrls(null)).toEqual([]);
  });

  it("diffRemovedBlogUrls returns before-minus-after (replacement set)", () => {
    const a = "https://res.cloudinary.com/demo/image/upload/along/blog/a.jpg";
    const b = "https://res.cloudinary.com/demo/image/upload/along/blog/b.jpg";
    const c = "https://res.cloudinary.com/demo/image/upload/along/blog/c.jpg";
    expect(diffRemovedBlogUrls([a, b], [b, c])).toEqual([a]);
    expect(diffRemovedBlogUrls([a], [a])).toEqual([]);
    expect(diffRemovedBlogUrls(null, [a])).toEqual([]);
  });
});
