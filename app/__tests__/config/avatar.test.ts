import { buildAvatarUrl, getFallbackAvatarUrl, AVATAR_STYLES } from "@/app/lib/config/avatar";

describe("buildAvatarUrl", () => {
  const DICEBEAR_BASE = "https://api.dicebear.com/9.x";

  it("returns URL with style and seed", () => {
    const url = buildAvatarUrl({ style: "avataaars", seed: "test-seed" });
    expect(url).toBe(`${DICEBEAR_BASE}/avataaars/svg?seed=test-seed`);
  });

  it("includes flip parameter when set", () => {
    const url = buildAvatarUrl({ style: "bottts", seed: "abc", flip: true });
    expect(url).toContain("flip=true");
  });

  it("includes backgroundColor when provided", () => {
    const url = buildAvatarUrl({
      style: "lorelei",
      seed: "def",
      backgroundColor: "b6e3f4",
    });
    expect(url).toContain("backgroundColor=b6e3f4");
  });

  it("omits optional parameters when not provided", () => {
    const url = buildAvatarUrl({ style: "notionists", seed: "ghi" });
    expect(url).not.toContain("flip");
    expect(url).not.toContain("backgroundColor");
  });

  it("encodes special characters in seed", () => {
    const url = buildAvatarUrl({ style: "avataaars", seed: "John Doe" });
    expect(url).toContain("seed=John+Doe");
  });
});

describe("getFallbackAvatarUrl", () => {
  it("returns URL with first name as seed", () => {
    const url = getFallbackAvatarUrl("Adaobi");
    expect(url).toContain("/avataaars/svg?seed=Adaobi");
  });

  it("encodes special characters in name", () => {
    const url = getFallbackAvatarUrl("John Doe");
    expect(url).toContain("seed=John%20Doe");
  });
});

describe("AVATAR_STYLES", () => {
  it("contains at least the original 5 style options", () => {
    expect(AVATAR_STYLES.length).toBeGreaterThanOrEqual(5);
  });

  it("each style has value, label, category and description", () => {
    AVATAR_STYLES.forEach((style) => {
      expect(style).toHaveProperty("value");
      expect(style).toHaveProperty("label");
      expect(style).toHaveProperty("category");
      expect(style).toHaveProperty("description");
    });
  });

  it("keeps the original styles available (non-breaking)", () => {
    const values = AVATAR_STYLES.map((s) => s.value);
    for (const legacy of ["avataaars", "bottts", "lorelei", "notionists"]) {
      expect(values).toContain(legacy);
    }
  });
});
