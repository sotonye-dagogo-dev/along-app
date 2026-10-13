import { BLOG_CONTENT_PROSE_CLASSES } from "@/app/lib/config/blog";
import {
  BLOG_MANAGEMENT_CONFIG,
  READING_TIME_FIELD_META,
  normalizeReadingTime,
  estimateReadingTime,
} from "@/app/lib/config/blogManagement";

describe("blog design compliance + reading time (directive)", () => {
  it("body prose uses text-primary, never secondary/muted for paragraphs", () => {
    expect(BLOG_CONTENT_PROSE_CLASSES).toContain("prose-p:text-text-primary");
    expect(BLOG_CONTENT_PROSE_CLASSES).not.toContain("prose-p:text-text-secondary");
    expect(BLOG_CONTENT_PROSE_CLASSES).not.toContain("prose-p:text-text-muted");
    expect(BLOG_CONTENT_PROSE_CLASSES).toContain("prose-li:text-text-primary");
    expect(BLOG_CONTENT_PROSE_CLASSES).toContain("prose-strong:text-text-primary");
    expect(BLOG_CONTENT_PROSE_CLASSES).toContain("prose-headings:text-text-primary");
    expect(BLOG_CONTENT_PROSE_CLASSES).toContain("prose-a:text-primary");
  });

  it("reading-time bounds are sane and field meta matches", () => {
    expect(BLOG_MANAGEMENT_CONFIG.minReadingTime).toBe(1);
    expect(BLOG_MANAGEMENT_CONFIG.maxReadingTime).toBe(120);
    expect(READING_TIME_FIELD_META.min).toBe(BLOG_MANAGEMENT_CONFIG.minReadingTime);
    expect(READING_TIME_FIELD_META.max).toBe(BLOG_MANAGEMENT_CONFIG.maxReadingTime);
    expect(READING_TIME_FIELD_META.label).toMatch(/reading time/i);
  });

  it("normalizeReadingTime clamps and rejects invalid input", () => {
    expect(normalizeReadingTime(3)).toBe(3);
    expect(normalizeReadingTime("4")).toBe(4);
    expect(normalizeReadingTime(2.4)).toBe(2);
    expect(normalizeReadingTime(0)).toBeNull();
    expect(normalizeReadingTime(-5)).toBeNull();
    expect(normalizeReadingTime("")).toBeNull();
    expect(normalizeReadingTime(undefined)).toBeNull();
    expect(normalizeReadingTime(999)).toBe(BLOG_MANAGEMENT_CONFIG.maxReadingTime);
  });

  it("estimateReadingTime falls back to at least the minimum", () => {
    expect(estimateReadingTime("")).toBe(BLOG_MANAGEMENT_CONFIG.minReadingTime);
    expect(estimateReadingTime("hello world")).toBe(BLOG_MANAGEMENT_CONFIG.minReadingTime);
    const long = new Array(600).fill("word").join(" ");
    expect(estimateReadingTime(long)).toBeGreaterThan(BLOG_MANAGEMENT_CONFIG.minReadingTime);
  });
});
