/**
 * NOTE: `@/app/lib/db/redis` is stubbed here (hoisted `jest.mock`) because
 * its `@upstash/redis → uncrypto` ESM chain cannot be parsed by the jest
 * transform in this repo ("Unexpected token 'export'"). The stub mirrors
 * the safe-wrapper's no-op-when-unconfigured behaviour (get → null,
 * set/del → no-op), which is exactly what these pure-helper tests need —
 * production code is untouched.
 */
jest.mock("@/app/lib/db/redis", () => ({
  getRedisClient: () => null,
  __resetRedisForTests: () => {},
  withTimeout: async <T>(p: Promise<T>) => p,
  REDIS_OP_TIMEOUT_MS: 1200,
  redis: {
    get: async <T>() => null as T | null,
    set: async () => {},
    del: async () => 0,
    _getClient: () => null,
    _withTimeout: async <T>(p: Promise<T>) => p,
  },
}));

import { renderEmailHtml, renderEmailText, renderEmailSubject, defaultEmailVars, sanitizeStoredBody } from "@/app/lib/utils/emailTemplates";import { escapeHtmlValue, sanitizeEmailHtml, stripTags, extractVariables } from "@/app/lib/utils/emailSanitize";
import { blocksToHtml, blocksToText, textToBlocks, htmlToBlocks } from "@/app/lib/utils/emailBuilder";
import { EMAIL_BUILDER_CONFIG, EMAIL_MANAGEMENT_CONFIG } from "@/app/lib/config/emailManagement";
import { EMAIL_DEFAULT_VARIABLES, EMAIL_ICONS, composeEmailDocument, DEFAULT_EMAIL_TEMPLATES } from "@/app/lib/config/email";
import { getEffectiveEnv, isProduction, getAppUrl } from "@/app/lib/config/env";

describe("email variable interpolation (no literal leakage)", () => {
  const tpl = { name: "t", subject: "Hi {{firstName}}", bodyHtml: "<p>Hi {{firstName}}, code {{otp}}</p>", bodyText: "Hi {{firstName}} {{otp}}", variables: ["firstName", "otp"] };
  it("renders provided vars", () => {
    expect(renderEmailHtml(tpl, { firstName: "Ada", otp: "123" })).toContain("Ada");
  });
  it("missing vars render as empty, never literal {{ident}}", () => {
    expect(renderEmailHtml(tpl, { firstName: "Ada" })).not.toContain("{{otp}}");
    expect(renderEmailText(tpl, {})).not.toContain("{{");
    expect(renderEmailSubject(tpl.subject, {})).not.toContain("{{");
  });
  it("escapes HTML in values (XSS-safe interpolation)", () => {
    const out = renderEmailHtml(tpl, { firstName: '<script>alert(1)</script>', otp: "1" });
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
  it("injects shared defaults (logoUrl/appUrl/appName/year)", () => {
    const d = defaultEmailVars();
    expect(d.logoUrl).toMatch(/logo\.svg$/);
    expect(d.appUrl).toBeTruthy();
    const tpl2 = { ...tpl, bodyHtml: "<img src=\"{{logoUrl}}\" />" };
    expect(renderEmailHtml(tpl2, {})).toContain("logo.svg");
  });
});

describe("email sanitization", () => {
  it("strips scripts + event handlers + javascript: urls", () => {
    const dirty = `<p onclick="evil()">Hi</p><script>alert(1)</script><a href="javascript:evil()">x</a>`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("Hi");
  });
  it("keeps email-safe tags and {{vars}} through storage sanitize", () => {
    const clean = sanitizeStoredBody(`<p>Hello {{firstName}}</p><a href="{{appUrl}}/home">Go</a>`);
    expect(clean).toContain("{{firstName}}");
    expect(clean).toContain("{{appUrl}}");
  });
  it("extracts variables from sources", () => {
    expect(extractVariables("<p>{{a}} {{b}}</p>", "Hi {{c}}")).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });
  it("escapeHtmlValue covers quotes", () => {
    expect(escapeHtmlValue(`a"b'c`)).toBe("a&quot;b&#39;c");
  });
  it("stripTags produces plain text", () => {
    // `[\s\S]` instead of the `s` (dotAll) flag: identical semantics, but
    // the flag needs target es2018+ and breaks `tsc --noEmit` on this repo.
    expect(stripTags("<h1>Hi</h1><p>there</p>")).toMatch(/Hi[\s\S]*there/);
  });
});

describe("email builder lossless conversions", () => {
  it("blocks -> html -> blocks preserves content", () => {
    const blocks = [
      { id: "1", type: "heading" as const, level: 1 as const, text: "Hello {{firstName}}" },
      { id: "2", type: "paragraph" as const, text: "Body here" },
      { id: "3", type: "button" as const, text: "Open", url: "{{appUrl}}/home" },
      { id: "4", type: "list" as const, items: ["a", "b"] },
    ];
    const html = blocksToHtml(blocks);
    expect(html).toContain("{{firstName}}");
    const back = htmlToBlocks(html);
    expect(back.length).toBeGreaterThanOrEqual(4);
  });
  it("blocks -> text -> blocks round-trips", () => {
    const blocks = [
      { id: "1", type: "paragraph" as const, text: "Hello {{firstName}}" },
      { id: "2", type: "list" as const, items: ["one", "two"] },
    ];
    const text = blocksToText(blocks);
    expect(text).toContain("{{firstName}}");
    const back = textToBlocks(text);
    expect(back.some((b) => b.type === "list")).toBe(true);
  });
  it("unknown html degrades to paragraphs (nothing dropped)", () => {
    const back = htmlToBlocks(`<table><tr><td>Cell content kept</td></tr></table>`);
    expect(JSON.stringify(back)).toContain("Cell content kept");
  });
});

describe("email wrapper + catalog config", () => {
  it("builder catalog covers blocks + variables + text mode", () => {
    expect(EMAIL_BUILDER_CONFIG.blocks.map((b) => b.id)).toEqual(
      expect.arrayContaining(["paragraph", "heading", "button", "image", "list", "link", "divider", "spacer"])
    );
    expect(EMAIL_BUILDER_CONFIG.variableCatalog.some((v) => v.name === "logoUrl")).toBe(true);
    expect(EMAIL_MANAGEMENT_CONFIG.editorModes).toEqual(expect.arrayContaining(["visual", "html", "text"]));
  });
  it("default variables include logoUrl", () => {
    expect(EMAIL_DEFAULT_VARIABLES.some((v) => v.name === "logoUrl")).toBe(true);
  });
  it("icons are inline SVG (no emoji in defaults)", () => {
    for (const svg of Object.values(EMAIL_ICONS)) expect(svg).toContain("<svg");
  });
  it("shared wrapper includes logo/header/body/cta/footer", () => {
    const doc = composeEmailDocument({ title: "T", bodyHtml: "<p>B</p>", cta: { label: "Go", url: "https://x" } });
    expect(doc).toContain("{{logoUrl}}");
    expect(doc).toContain("Go");
    expect(doc).toContain("{{year}}");
  });
  it("new lifecycle templates ship as system templates", () => {
    for (const n of ["verifyEmail", "changeEmail", "changePassword"]) {
      expect(DEFAULT_EMAIL_TEMPLATES.some((t) => t.name === n)).toBe(true);
    }
  });
});

describe("env differentiation", () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });
  it("PROJECT_ENV wins over NODE_ENV", () => {
    process.env.PROJECT_ENV = "production";
    // `NODE_ENV` is typed readonly in recent @types/node — write through a
    // mutable view instead (test-only, same runtime behaviour).
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    expect(getEffectiveEnv()).toBe("production");
    expect(isProduction()).toBe(true);
  });
  it("falls back to NODE_ENV when PROJECT_ENV unset", () => {
    delete process.env.PROJECT_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(getEffectiveEnv()).toBe("production");
  });
  it("getAppUrl never empty", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.PROJECT_ENV = "development";
    expect(getAppUrl()).toContain("http");
  });
});
