/**
 * Email visual-builder model — lossless conversions between
 * blocks <-> HTML <-> plain text.
 *
 * The Studio keeps ONE source of truth (blocks). Switching editor modes
 * never discards content:
 * - blocks -> html (deterministic renderer, shared wrapper-agnostic)
 * - html -> blocks (best-effort parser: headings/paragraphs/lists/images/
 *   links/buttons/dividers fall back to paragraph blocks so nothing is lost)
 * - blocks -> text (plain-text in-place editing parses back line-by-line)
 * - text -> blocks (blank-line separated paragraphs; `- ` lines become lists)
 *
 * All functions are pure, dependency-free, and never throw.
 */

export type EmailBlockType =
  | "heading"
  | "paragraph"
  | "button"
  | "image"
  | "list"
  | "link"
  | "divider"
  | "spacer";

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  /** Main content (heading/paragraph text, button label, link text, image alt). */
  text?: string;
  /** URL for button / link / image blocks. */
  url?: string;
  /** Image src (alias of url for clarity in the builder UI). */
  src?: string;
  /** List items for list blocks. */
  items?: string[];
  /** Heading level. */
  level?: 1 | 2 | 3;
}

export const EMAIL_BLOCK_DEFS = [
  { id: "heading", label: "Heading", description: "Title or section header" },
  { id: "paragraph", label: "Paragraph", description: "Body text (supports {{variables}})" },
  { id: "button", label: "Button / CTA", description: "Call-to-action link button" },
  { id: "image", label: "Image", description: "Banner or inline image" },
  { id: "list", label: "List", description: "Bulleted list" },
  { id: "link", label: "Link", description: "Inline text link" },
  { id: "divider", label: "Divider", description: "Horizontal rule" },
  { id: "spacer", label: "Spacer", description: "Vertical whitespace" },
] as const;

let blockSeq = 0;
export function newBlockId(): string {
  blockSeq += 1;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  return `blk-${Date.now().toString(36)}-${blockSeq}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function unesc(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

/** Render blocks to an email-safe HTML fragment (wrapper applied separately). */
export function blocksToHtml(blocks: EmailBlock[]): string {
  try {
    return blocks.map((b) => {
      switch (b.type) {
        case "heading": {
          const lvl = b.level === 2 ? "h2" : b.level === 3 ? "h3" : "h1";
          const size = lvl === "h1" ? "20px" : lvl === "h2" ? "17px" : "15px";
          return `<${lvl} style="font-size:${size};font-weight:700;margin:0 0 12px;color:#1a1a1a">${b.text ?? ""}</${lvl}>`;
        }
        case "button": {
          const href = esc(b.url ?? "#");
          return `<div style="text-align:center;margin:16px 0"><a href="${href}" style="display:inline-block;background:#00A862;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">${b.text ?? "Open"}</a></div>`;
        }
        case "image": {
          const src = esc(b.src ?? b.url ?? "");
          const alt = esc(b.text ?? "");
          if (!src) return "";
          return `<div style="text-align:center;margin:16px 0"><img src="${src}" alt="${alt}" style="max-width:100%;border-radius:8px" /></div>`;
        }
        case "list": {
          const items = (b.items ?? []).map((i) => `<li style="font-size:14px;color:#444;line-height:1.7">${i}</li>`).join("");
          return `<ul style="margin:0 0 12px;padding-left:20px">${items}</ul>`;
        }
        case "link": {
          const href = esc(b.url ?? "#");
          return `<p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6"><a href="${href}" style="color:#00A862">${b.text ?? href}</a></p>`;
        }
        case "divider":
          return `<hr style="border:none;border-top:1px solid #eee;margin:16px 0" />`;
        case "spacer":
          return `<div style="height:16px"></div>`;
        case "paragraph":
        default:
          return `<p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6">${b.text ?? ""}</p>`;
      }
    }).filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

/** Render blocks to editable plain text (variables preserved verbatim). */
export function blocksToText(blocks: EmailBlock[]): string {
  try {
    const lines: string[] = [];
    for (const b of blocks) {
      switch (b.type) {
        case "heading": lines.push(`# ${(b.text ?? "").trim()}`); lines.push(""); break;
        case "paragraph": lines.push((b.text ?? "").trim()); lines.push(""); break;
        case "button": lines.push(`[${(b.text ?? "Open").trim()}](${(b.url ?? "").trim()})`); lines.push(""); break;
        case "image": lines.push(`![${(b.text ?? "").trim()}](${(b.src ?? b.url ?? "").trim()})`); lines.push(""); break;
        case "list": for (const i of b.items ?? []) lines.push(`- ${i.trim()}`); lines.push(""); break;
        case "link": lines.push(`[${(b.text ?? b.url ?? "").trim()}](${(b.url ?? "").trim()})`); lines.push(""); break;
        case "divider": lines.push("---"); lines.push(""); break;
        case "spacer": lines.push(""); break;
      }
    }
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return "";
  }
}

/** Parse edited plain text back to blocks (lossless for builder round-trips). */
export function textToBlocks(text: string): EmailBlock[] {
  try {
    const chunks = String(text ?? "").split(/\n\s*\n/);
    const blocks: EmailBlock[] = [];
    for (const chunk of chunks) {
      const t = chunk.trim();
      if (!t) { blocks.push({ id: newBlockId(), type: "spacer" }); continue; }
      if (/^---+$/.test(t)) { blocks.push({ id: newBlockId(), type: "divider" }); continue; }
      if (/^#{1,3}\s+/.test(t)) {
        const level = t.startsWith("### ") ? 3 : t.startsWith("## ") ? 2 : 1;
        blocks.push({ id: newBlockId(), type: "heading", level: level as 1 | 2 | 3, text: t.replace(/^#{1,3}\s+/, "") });
        continue;
      }
      const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0 && lines.every((l) => l.startsWith("- "))) {
        blocks.push({ id: newBlockId(), type: "list", items: lines.map((l) => l.slice(2)) });
        continue;
      }
      const mdImg = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (mdImg) { blocks.push({ id: newBlockId(), type: "image", text: unesc(mdImg[1]), src: mdImg[2], url: mdImg[2] }); continue; }
      const mdLink = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mdLink) {
        const label = mdLink[1]; const href = mdLink[2];
        // Bare CTA-looking links become buttons, others stay links.
        if (/^(open|start|verify|confirm|reset|view|explore|cta|button)/i.test(label) || /verify|reset|confirm|action/i.test(href)) {
          blocks.push({ id: newBlockId(), type: "button", text: unesc(label), url: href });
        } else {
          blocks.push({ id: newBlockId(), type: "link", text: unesc(label), url: href });
        }
        continue;
      }
      blocks.push({ id: newBlockId(), type: "paragraph", text: chunk.trim() });
    }
    return blocks.length ? blocks : [{ id: newBlockId(), type: "paragraph", text: "" }];
  } catch {
    return [{ id: newBlockId(), type: "paragraph", text: String(text ?? "") }];
  }
}

/**
 * Parse stored HTML back to blocks. Unknown/complex markup degrades to
 * paragraph blocks carrying the inner text — content is never dropped.
 */
export function htmlToBlocks(html: string): EmailBlock[] {
  try {
    const blocks: EmailBlock[] = [];
    const src = String(html ?? "");
    // Strip wrapper tables but keep inner content markers.
    const re = /<(h1|h2|h3|p|ul|ol|hr|img|a)[^>]*>([\s\S]*?)<\/\1\s*>|<(img|hr)[^>]*\/?>/gi;
    let m: RegExpExecArray | null;
    let matched = false;
    while ((m = re.exec(src)) !== null) {
      matched = true;
      const tag = (m[1] ?? m[3] ?? "").toLowerCase();
      const full = m[0];
      const inner = (m[2] ?? "").trim();
      if (tag === "h1" || tag === "h2" || tag === "h3") {
        blocks.push({ id: newBlockId(), type: "heading", level: tag === "h1" ? 1 : tag === "h2" ? 2 : 3, text: inner });
      } else if (tag === "ul" || tag === "ol") {
        const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li\s*>/gi)].map((x) => x[1].trim()).filter(Boolean);
        blocks.push({ id: newBlockId(), type: "list", items: items.length ? items : [inner.replace(/<[^>]+>/g, " ").trim()] });
      } else if (tag === "img" || (tag === "" && /<img/i.test(full))) {
        const srcM = full.match(/src\s*=\s*"([^"]*)"/i) ?? full.match(/src\s*=\s*'([^']*)'/i);
        const altM = full.match(/alt\s*=\s*"([^"]*)"/i) ?? full.match(/alt\s*=\s*'([^']*)'/i);
        blocks.push({ id: newBlockId(), type: "image", src: srcM?.[1] ?? "", url: srcM?.[1] ?? "", text: altM?.[1] ? unesc(altM[1]) : "" });
      } else if (tag === "hr") {
        blocks.push({ id: newBlockId(), type: "divider" });
      } else if (tag === "a" && !/<(p|div|table)/i.test(inner)) {
        const hrefM = full.match(/href\s*=\s*"([^"]*)"/i) ?? full.match(/href\s*=\s*'([^']*)'/i);
        const label = inner.replace(/<[^>]+>/g, "").trim() || hrefM?.[1] || "Open";
        if (/padding|background:#00A862/i.test(full)) blocks.push({ id: newBlockId(), type: "button", text: label, url: hrefM?.[1] ?? "#" });
        else blocks.push({ id: newBlockId(), type: "link", text: label, url: hrefM?.[1] ?? "#" });
      } else if (tag === "p") {
        if (!inner.replace(/<[^>]+>/g, "").trim() && !/\{\{/.test(inner)) continue;
        // CTA paragraphs containing a single prominent link become buttons.
        const linkM = inner.match(/<a[^>]*href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a\s*>/i);
        const textOnly = inner.replace(/<[^>]+>/g, "").trim();
        if (linkM && /padding|background/i.test(inner) && textOnly.length < 80) {
          blocks.push({ id: newBlockId(), type: "button", text: linkM[2].replace(/<[^>]+>/g, "").trim(), url: linkM[1] });
        } else {
          blocks.push({ id: newBlockId(), type: "paragraph", text: inner });
        }
      }
    }
    if (!matched) {
      const text = src.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text) return [{ id: newBlockId(), type: "paragraph", text }];
      return [{ id: newBlockId(), type: "paragraph", text: "" }];
    }
    return blocks.length ? blocks : [{ id: newBlockId(), type: "paragraph", text: "" }];
  } catch {
    return [{ id: newBlockId(), type: "paragraph", text: "" }];
  }
}

/** Default starter blocks for a brand-new custom template. */
export function defaultBlocks(): EmailBlock[] {
  return [
    { id: newBlockId(), type: "heading", level: 1, text: "Hello {{firstName}}" },
    { id: newBlockId(), type: "paragraph", text: "Add your message here. Use {{variables}} for personalization." },
    { id: newBlockId(), type: "button", text: "Open Along", url: "{{appUrl}}/home" },
  ];
}
