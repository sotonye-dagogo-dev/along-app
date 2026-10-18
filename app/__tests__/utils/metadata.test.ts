import { buildMetadata, buildPostMetadata, buildProfileMetadata } from "@/app/lib/utils/metadata";
import { DEFAULT_META } from "@/app/lib/config";

/**
 * Simulates Next.js title-template composition (resolve-title.js): the root
 * layout template `%s${titleSuffix}` is applied to a page's bare title.
 * A page that manually appends the suffix would render it twice.
 */
function applyRootTemplate(title: string): string {
  return `%s${DEFAULT_META.titleSuffix}`.replace("%s", title);
}

describe("buildMetadata", () => {
  const defaultPath = "/test";
  const defaultTitle = "Test Page";
  const defaultDescription = "A test description for the page.";

  it("returns a bare title (root layout template appends the suffix)", () => {
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: defaultPath,
    });
    expect(meta.title).toBe("Test Page");
    expect(applyRootTemplate(meta.title as string)).toBe("Test Page | Along");
  });

  it("never renders a doubled suffix under the root template", () => {
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: defaultPath,
    });
    expect(applyRootTemplate(meta.title as string)).not.toContain(
      `${DEFAULT_META.titleSuffix}${DEFAULT_META.titleSuffix}`,
    );
  });

  it("keeps exactly one suffix on OpenGraph and Twitter titles (no template there)", () => {
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: defaultPath,
    });
    const og = meta.openGraph as Record<string, unknown>;
    const tw = meta.twitter as Record<string, unknown>;
    expect(og.title).toBe(`Test Page${DEFAULT_META.titleSuffix}`);
    expect(tw.title).toBe(`Test Page${DEFAULT_META.titleSuffix}`);
    expect(og.title).not.toContain(`${DEFAULT_META.titleSuffix}${DEFAULT_META.titleSuffix}`);
  });

  it("returns correct description", () => {
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: defaultPath,
    });
    expect(meta.description).toBe(defaultDescription);
  });

  it("sets canonical URL correctly", () => {
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: "/about",
    });
    expect(meta.alternates?.canonical).toContain("/about");
  });

  it("allows robots index when noIndex is false", () => {
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: defaultPath,
      noIndex: false,
    });
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("disables robots index when noIndex is true", () => {
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: defaultPath,
      noIndex: true,
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("includes OpenGraph data", () => {
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: defaultPath,
    });
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.title).toContain("Test Page");
    expect(og.description).toBe(defaultDescription);
    expect(og.siteName).toBe("Along");
    expect(og.type).toBe("website");
  });

  it("includes Twitter card data", () => {
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: defaultPath,
    });
    const tw = meta.twitter as Record<string, unknown>;
    expect(tw.card).toBe("summary_large_image");
    expect(tw.title).toContain("Test Page");
    expect(tw.description).toBe(defaultDescription);
  });

  it("uses custom ogImage when provided", () => {
    const customImage = "/images/custom-og.jpg";
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: defaultPath,
      ogImage: customImage,
    });
    expect(meta.openGraph?.images).toEqual(
      expect.arrayContaining([expect.objectContaining({ url: customImage })])
    );
  });

  it("falls back to default ogImage", () => {
    const meta = buildMetadata({
      title: defaultTitle,
      description: defaultDescription,
      path: defaultPath,
    });
    expect(meta.openGraph?.images).toBeDefined();
  });
});

describe("buildPostMetadata", () => {
  const post = {
    title: "Lagos to Ibadan",
    description: "Fast route via Iwo road",
    createdAt: new Date("2026-01-05T10:00:00Z"),
    type: "ROUTE",
    images: [] as string[],
    user: { firstName: "Ada", userName: "ada" },
  };

  it("returns a bare title composed to a single suffix by the root template", async () => {
    const meta = await buildPostMetadata(post, "/posts/p1");
    expect(meta.title).toBe("Lagos to Ibadan");
    expect(applyRootTemplate(meta.title as string)).toBe("Lagos to Ibadan | Along");
  });

  it("keeps one suffix on OpenGraph/Twitter titles", async () => {
    const meta = await buildPostMetadata(post, "/posts/p1");
    const og = meta.openGraph as Record<string, unknown>;
    const tw = meta.twitter as Record<string, unknown>;
    expect(og.title).toBe(`Lagos to Ibadan${DEFAULT_META.titleSuffix}`);
    expect(tw.title).toBe(`Lagos to Ibadan${DEFAULT_META.titleSuffix}`);
    expect(og.title).not.toContain(`${DEFAULT_META.titleSuffix}${DEFAULT_META.titleSuffix}`);
  });

  it("still noIndexes missing posts with a single composed suffix", async () => {
    const meta = await buildPostMetadata(null, "/posts/missing");
    expect(applyRootTemplate(meta.title as string)).toBe("Post Not Found | Along");
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

describe("buildProfileMetadata", () => {
  const profile = {
    firstName: "Ada",
    lastName: "Obi",
    userName: "adaobi",
    bio: null,
    avatar: null,
  };

  it("returns a bare title composed to a single suffix by the root template", async () => {
    const meta = await buildProfileMetadata(profile, "/profile/adaobi");
    expect(meta.title).toBe("Ada Obi (@adaobi)");
    expect(applyRootTemplate(meta.title as string)).toBe("Ada Obi (@adaobi) | Along");
  });

  it("keeps one suffix on OpenGraph/Twitter titles", async () => {
    const meta = await buildProfileMetadata(profile, "/profile/adaobi");
    const og = meta.openGraph as Record<string, unknown>;
    const tw = meta.twitter as Record<string, unknown>;
    expect(og.title).toBe(`Ada Obi (@adaobi)${DEFAULT_META.titleSuffix}`);
    expect(tw.title).toBe(`Ada Obi (@adaobi)${DEFAULT_META.titleSuffix}`);
  });
});

/**
 * Source-level regression: no page/layout may hand-append the brand suffix —
 * the root `title.template` owns it. A manual suffix renders
 * "Page | Along | Along" in the browser tab and SERPs.
 */
describe("title suffix compliance (source scan)", () => {
  const fs = require("fs");
  const path = require("path");

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "generated" || entry.name === "node_modules") continue;
        walk(full, out);
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  it("has no manual `| Along` title literals outside comments/config", () => {
    const root = path.join(__dirname, "..", "..");
    const offenders: string[] = [];
    for (const file of walk(root)) {
      const src = fs.readFileSync(file, "utf8");
      const lines = src.split("\n");
      lines.forEach((line: string, i: number) => {
        if (!line.includes("| Along")) return;
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
        if (file.endsWith(path.join("config", "seo.ts"))) return; // titleSuffix definition/docs
        offenders.push(`${path.relative(root, file)}:${i + 1}: ${trimmed}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
