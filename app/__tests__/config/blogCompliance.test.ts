import { BLOG_CONTENT_PROSE_CLASSES } from "@/app/lib/config/blog";
import { blocksToBlogHtml } from "@/app/lib/utils/emailBuilder";
import { sanitizeBlogHtml } from "@/app/lib/utils/emailSanitize";
import { buildBlogVarContext, renderBlogContent } from "@/app/lib/utils/blogVariables";
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

  it("blocksToBlogHtml emits semantic article HTML with no inline color/font styles", () => {
    const html = blocksToBlogHtml([
      { id: "1", type: "heading", level: 1, text: "Hello {{firstName}}" },
      { id: "2", type: "paragraph", text: "Body copy here." },
      { id: "3", type: "list", items: ["First", "Second"] },
      { id: "4", type: "link", text: "Explore", url: "/explore" },
      { id: "5", type: "button", text: "Open Along", url: "/home" },
      { id: "6", type: "divider" },
    ]);
    expect(html).toContain("<h1>");
    expect(html).toContain("<p>Body copy here.</p>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>First</li>");
    expect(html).toContain('<a href="/explore">Explore</a>');
    // Button blocks render as CTA buttons (same treatment as Email Studio),
    // token-styled via .blog-cta CSS — never plain inline links, never
    // hardcoded email chrome/inline colors.
    expect(html).toContain('class="blog-cta-wrap"');
    expect(html).toContain('class="blog-cta"');
    expect(html).toContain('<a class="blog-cta" href="/home">Open Along</a>');
    expect(html).toContain("<hr");
    // {{variables}} survive verbatim for renderBlogContent.
    expect(html).toContain("{{firstName}}");
    // No hardcoded email colors / font sizes that would beat prose classes.
    expect(html).not.toMatch(/#444|#1a1a1a|#00A862/i);
    expect(html).not.toMatch(/font-size|color:/i);
  });

  it("blocksToBlogHtml escapes HTML in text but preserves structure", () => {
    const html = blocksToBlogHtml([
      { id: "1", type: "paragraph", text: '<script>alert("x")</script>Hi' },
    ]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<p>");
  });

  it("sanitizeBlogHtml strips legacy inline styles + scripts, keeps structure and vars", () => {
    const legacy =
      '<p style="font-size:14px;color:#444;margin:0 0 12px">Hi {{firstName||traveller}}</p>' +
      '<h1 style="font-size:20px;color:#1a1a1a">Title</h1>' +
      '<ul style="margin:0"><li style="color:#444">Item</li></ul>' +
      '<script>alert("x")</script>';
    const clean = sanitizeBlogHtml(legacy);
    expect(clean).toContain("<p>Hi {{firstName||traveller}}</p>");
    expect(clean).toContain("<h1>Title</h1>");
    expect(clean).toContain("<li>Item</li>");
    expect(clean).not.toMatch(/style\s*=/i);
    expect(clean).not.toContain("<script>");
    expect(clean).not.toMatch(/#444|#1a1a1a/i);
  });

  it("sanitizeBlogHtml preserves blog-cta classes but strips arbitrary classes", () => {
    const cta = '<div class="blog-cta-wrap"><a class="blog-cta" href="/home">Open Along</a></div>';
    const clean = sanitizeBlogHtml(cta);
    expect(clean).toContain('class="blog-cta-wrap"');
    expect(clean).toContain('class="blog-cta"');
    const evil = sanitizeBlogHtml('<div class="evil-hook" onclick="alert(1)"><a class="blog-cta evil" href="javascript:alert(1)">X</a></div>');
    expect(evil).not.toContain("evil");
    expect(evil).not.toContain("onclick");
    expect(evil).not.toContain("javascript:");
  });

  it("article pipeline resolves variables with no raw token leak (preview == public)", () => {
    const article = sanitizeBlogHtml(
      blocksToBlogHtml([
        { id: "1", type: "paragraph", text: "Hi {{firstName||traveller}}, welcome to {{appName||Along}}." },
      ]),
    );
    const rendered = renderBlogContent(
      article,
      buildBlogVarContext({ title: "Preview", author: "Along Team", category: "updates" }, null),
    );
    expect(rendered).not.toMatch(/\{\{/);
    expect(rendered).toContain("traveller");
    expect(rendered).toContain("Along");
  });
});
