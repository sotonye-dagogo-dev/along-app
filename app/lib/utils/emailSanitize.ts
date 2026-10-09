/**
 * Email sanitization utilities — shared by template storage (server),
 * variable interpolation (server), and preview rendering.
 * Zero dependencies, never throws.
 */

const ALLOWED_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "br", "hr",
  "strong", "b", "em", "i", "u", "s", "small",
  "a", "img", "ul", "ol", "li",
  "table", "tr", "td", "th", "tbody", "thead",
  "div", "span", "blockquote", "pre", "code",
  "center", "font",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "style"]),
  img: new Set(["src", "alt", "width", "height", "style"]),
  table: new Set(["width", "cellpadding", "cellspacing", "style", "role"]),
  tr: new Set(["style"]),
  td: new Set(["style", "align", "valign", "colspan", "width"]),
  th: new Set(["style", "align", "valign", "colspan", "width"]),
  div: new Set(["style"]),
  span: new Set(["style"]),
  p: new Set(["style"]),
  h1: new Set(["style"]),
  h2: new Set(["style"]),
  h3: new Set(["style"]),
  h4: new Set(["style"]),
  blockquote: new Set(["style"]),
  font: new Set(["color", "size", "face"]),
};

function isSafeUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (u.startsWith("#") || u.startsWith("/") || u.startsWith("mailto:") || u.startsWith("{{")) return true;
  return /^https?:\/\//i.test(u);
}

/** Escape a variable value for safe HTML interpolation. */
export function escapeHtmlValue(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip tags entirely (for plain-text fallback / storage guards). */
export function stripTags(html: string): string {
  try {
    return html.replace(/<script[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[ \t ]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return "";
  }
}

/**
 * Allowlist HTML sanitizer for stored email bodies.
 * Keeps email-safe tags/attrs + inline styles, drops scripts, event
 * handlers, javascript: URLs, and unknown tags (content preserved).
 */
export function sanitizeEmailHtml(dirty: string, maxLen = 100000): string {
  try {
    let out = String(dirty ?? "").slice(0, maxLen);
    out = out.replace(/<script[\s\S]*?<\/script\s*>/gi, "");
    out = out.replace(/<style[\s\S]*?<\/style\s*>/gi, "");
    out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    out = out.replace(/href\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'href="#"');
    out = out.replace(/src\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'src=""');
    out = out.replace(/<\/?.+?>/g, (tag) => {
      const m = tag.match(/^<\/?([a-zA-Z0-9]+)/);
      if (!m) return "";
      const name = m[1].toLowerCase();
      if (name === "html" || name === "head" || name === "body" || name === "meta" || name === "title" || name === "!doctype") return tag.includes("table") ? tag : (tag.startsWith("</") ? "" : "");
      if (!ALLOWED_TAGS.has(name)) {
        // Drop the tag itself but keep inner text.
        return tag.startsWith("</") ? "" : "";
      }
      const allowed = ALLOWED_ATTRS[name];
      if (!allowed) {
        return tag.startsWith("</") ? `</${name}>` : `<${name}>`;
      }
      // Rebuild opening tag with only allowed attrs.
      if (tag.startsWith("</")) return `</${name}>`;
      const selfClose = tag.endsWith("/>");
      const attrRe = /([a-zA-Z-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
      const kept: string[] = [];
      let am: RegExpExecArray | null;
      while ((am = attrRe.exec(tag)) !== null) {
        const key = am[1].toLowerCase();
        const val = am[2];
        if (!allowed.has(key) && key !== "style") continue;
        if ((key === "href" || key === "src") && !isSafeUrl(val.replace(/^["']|["']$/g, ""))) continue;
        if (key === "style") {
          const styleVal = val.replace(/^["']|["']$/g, "");
          if (/expression|javascript:|behaviour|behavior|binding/i.test(styleVal)) continue;
        }
        kept.push(`${key}=${val}`);
      }
      // Preserve bare style-less structural attrs
      return `<${name}${kept.length ? " " + kept.join(" ") : ""}${selfClose ? " /" : ""}>`;
    });
    return out.slice(0, maxLen);
  } catch {
    return "";
  }
}

/** Extract {{variable}} identifiers from subject + html + text.
 * Supports fallback syntax `{{name||fallback}}` / `{{name|fallback}}` /
 * `{{ name }}` — only the variable name is returned. */
export function extractVariables(...sources: string[]): string[] {
  try {
    const found = new Set<string>();
    for (const src of sources) {
      if (!src) continue;
      for (const m of src.matchAll(/\{\{\s*(\w+)(?:\s*\|\|?\s*[^}]*)?\s*\}\}/g)) found.add(m[1]);
    }
    return [...found].slice(0, 50);
  } catch {
    return [];
  }
}

/**
 * Parse the inside of a `{{...}}` token into name + fallback.
 * Accepts `name`, `name||fallback`, `name|fallback` with optional quotes
 * and surrounding whitespace. Returns null when no valid name leads.
 */
export function parseVarToken(inner: string): { name: string; fallback: string } | null {
  try {
    const m = String(inner ?? "").match(/^\s*(\w+)\s*(?:\|\|?\s*([\s\S]*?))?\s*$/);
    if (!m) return null;
    let fb = (m[2] ?? "").trim();
    if ((fb.startsWith('"') && fb.endsWith('"')) || (fb.startsWith("'") && fb.endsWith("'"))) {
      fb = fb.slice(1, -1);
    }
    return { name: m[1], fallback: fb };
  } catch {
    return null;
  }
}

/** Match any `{{...}}` placeholder including fallback syntax. */
export const VAR_TOKEN_RE = /\{\{\s*\w+(?:\s*\|\|?\s*[^}]*)?\s*\}\}/g;

/** Sanitize a display-name-ish variable (no tags, capped length). */
export function sanitizeVarText(raw: unknown, maxLen = 500): string {
  return stripTags(String(raw ?? "")).slice(0, maxLen);
}
