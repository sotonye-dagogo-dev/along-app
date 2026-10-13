import {
  FEATURED_BLOGS_CONFIG,
  pickFeaturedBlogs,
  featuredBlogHref,
  auditActionMeta,
  auditEntityMeta,
} from "@/app/lib/config";
import { DEFAULT_BLOG_POSTS } from "@/app/lib/config/blogManagement";
import { htmlToBlocks, blocksToHtml } from "@/app/lib/utils/emailBuilder";

const EMDASH = /[—–―]/;

describe("featured blogs config (Sprint 52)", () => {
  it("exposes section copy, CTAs, and sane limits", () => {
    expect(FEATURED_BLOGS_CONFIG.maxItems).toBeGreaterThanOrEqual(3);
    expect(FEATURED_BLOGS_CONFIG.sectionTitle).toBeTruthy();
    expect(FEATURED_BLOGS_CONFIG.readPostLabel).toBeTruthy();
    expect(FEATURED_BLOGS_CONFIG.viewAllLabel).toBeTruthy();
    expect(FEATURED_BLOGS_CONFIG.carouselDurationSec).toBeGreaterThan(0);
  });

  it("keeps user-facing copy free of emdashes", () => {
    const copy = [
      FEATURED_BLOGS_CONFIG.sectionTitle,
      FEATURED_BLOGS_CONFIG.sectionSubtitle,
      FEATURED_BLOGS_CONFIG.readPostLabel,
      FEATURED_BLOGS_CONFIG.viewAllLabel,
      FEATURED_BLOGS_CONFIG.emptyTitle,
      FEATURED_BLOGS_CONFIG.emptyDescription,
    ];
    for (const s of copy) expect(s).not.toMatch(EMDASH);
  });

  it("picks newest first and caps at maxItems", () => {
    const posts = [
      { slug: "old", title: "Old", description: "", date: "2026-01-01", author: "A", category: "tips", image: "", readingTime: 1 },
      { slug: "new", title: "New", description: "", date: "2026-09-01", author: "A", category: "tips", image: "", readingTime: 1 },
      { slug: "mid", title: "Mid", description: "", date: "2026-05-01", author: "A", category: "tips", image: "", readingTime: 1 },
    ];
    expect(pickFeaturedBlogs(posts).map((p) => p.slug)).toEqual(["new", "mid", "old"]);
    expect(pickFeaturedBlogs(posts, 2)).toHaveLength(2);
    expect(pickFeaturedBlogs([])).toEqual([]);
    expect(pickFeaturedBlogs(null as never)).toEqual([]);
  });

  it("builds safe blog hrefs", () => {
    expect(featuredBlogHref("welcome-to-along")).toBe("/blog/welcome-to-along");
    expect(featuredBlogHref("")).toBe("/blog");
    expect(featuredBlogHref(null)).toBe("/blog");
  });
});

describe("default blogs enrichment (Sprint 52)", () => {
  it("ships at least six published defaults across categories", () => {
    expect(DEFAULT_BLOG_POSTS.length).toBeGreaterThanOrEqual(6);
    const cats = new Set(DEFAULT_BLOG_POSTS.map((p) => p.category));
    expect(cats.has("tips")).toBe(true);
    expect(cats.has("updates")).toBe(true);
    expect(cats.has("community")).toBe(true);
    expect(cats.has("routes")).toBe(true);
    expect(DEFAULT_BLOG_POSTS.every((p) => p.status === "published")).toBe(true);
    const slugs = DEFAULT_BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps default copy free of emdashes and uses variable fallbacks", () => {
    for (const p of DEFAULT_BLOG_POSTS) {
      expect(p.title).not.toMatch(EMDASH);
      expect(p.description).not.toMatch(EMDASH);
      expect(p.content).not.toMatch(EMDASH);
      expect(p.content).toMatch(/<h1>/);
    }
    const withVars = DEFAULT_BLOG_POSTS.filter((p) => p.content.includes("{{"));
    expect(withVars.length).toBeGreaterThan(0);
    // Every variable token carries a fallback so guests never see raw identifiers.
    for (const p of withVars) {
      const tokens = [...p.content.matchAll(/\{\{\s*([\s\S]*?)\s*\}\}/g)].map((m) => m[1]);
      expect(tokens.length).toBeGreaterThan(0);
      for (const t of tokens) expect(t).toMatch(/\|\|/);
    }
  });
});

describe("audit trail report + blog actions (Sprint 52)", () => {
  it("resolves report actions to friendly labels", () => {
    expect(auditEntityMeta("report").label).toBe("Report");
    expect(auditActionMeta("report.create").label).toBe("Report filed");
    expect(auditActionMeta("report.moderate").label).toBe("Report moderated");
    expect(auditActionMeta("report.status").label).toBe("Report status set");
  });

  it("resolves blog lifecycle actions specifically (not just the generic prefix)", () => {
    expect(auditActionMeta("blog.upsert").label).toBe("Blog saved");
    expect(auditActionMeta("blog.delete").label).toBe("Blog deleted");
    expect(auditActionMeta("blog.restore-default").label).toBe("Blog restored to default");
    expect(auditActionMeta("blog.bulk.published").label).toBe("Blog bulk update");
  });
});

describe("blog studio parsing without loss (Sprint 52)", () => {
  it("strips inline tags to plain text (no raw html in paragraphs)", () => {
    const blocks = htmlToBlocks("<p>Hi <strong>traveller</strong>. Welcome.</p>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text ?? "").toContain("traveller");
    expect(blocks[0].text ?? "").not.toContain("<strong>");
    expect(blocksToHtml(blocks)).toContain("traveller");
  });

  it("captures bare text between tags and keeps wrapper structure", () => {
    const blocks = htmlToBlocks("<section><h2>Title</h2></section>Loose intro line<p>Body text.</p>");
    const texts = blocks.map((b) => b.text ?? "").join(" ");
    expect(texts).toMatch(/Loose intro line/);
    expect(texts).toMatch(/Body text/);
    expect(blocks.some((b) => b.type === "heading" && (b.text ?? "").includes("Title"))).toBe(true);
  });

  it("maps h4 and br without dropping content", () => {
    const blocks = htmlToBlocks("<h4>Small head</h4><p>First<br>Second</p><br>");
    expect(blocks.some((b) => b.type === "heading" && (b.text ?? "").includes("Small head"))).toBe(true);
    expect(blocks.map((b) => b.text ?? "").join(" ")).toMatch(/First/);
    expect(blocks.map((b) => b.text ?? "").join(" ")).toMatch(/Second/);
  });

  it("never returns empty for readable input", () => {
    const blocks = htmlToBlocks("<div><span>Just words</span></div>");
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.map((b) => `${b.text ?? ""}${(b.items ?? []).join(" ")}`).join(" ")).toMatch(/Just words/);
  });
});
