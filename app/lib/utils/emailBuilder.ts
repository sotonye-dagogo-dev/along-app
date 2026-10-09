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
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").replace(/&nbsp;/gi, " ");
}

/** Strip ALL tags + decode entities; collapses whitespace. Never throws. */
function toPlainText(html: string): string {
  try {
    return unesc(String(html ?? "").replace(/<[^>]+>/g, " ")).replace(/[ \t\u00a0]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  } catch {
    return "";
  }
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
          const rawSrc = (b.src ?? b.url ?? "").trim();
          const src = esc(rawSrc);
          // Alt falls back to the app-name var so logo blocks stay
          // meaningful even when the admin leaves alt empty.
          const altRaw = (b.text ?? "").trim() || "{{appName}}";
          const alt = esc(altRaw);
          if (!rawSrc) return "";
          return `<div style="text-align:center;margin:16px 0"><img src="${src}" alt="${alt}" width="120" style="max-width:100%;height:auto;border:0;outline:none;border-radius:8px;display:inline-block" /></div>`;
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
 * paragraph blocks carrying PLAIN TEXT (tags stripped) — content is never
 * dropped and paragraphs never display raw HTML. Handles headings,
 * paragraphs, divs, table cells, lists, images, links/CTAs, dividers.
 */
export function htmlToBlocks(html: string): EmailBlock[] {
  try {
    const blocks: EmailBlock[] = [];
    const src = String(html ?? "");
    // Order matters: lists + images + hrs first, then headings, then
    // link/CTA and text containers (p/div/td/li/blockquote/center/span).
    const re = /<(ul|ol)[^>]*>([\s\S]*?)<\/\1\s*>|<(img|hr)[^>]*\/?>|<(h1|h2|h3|p|div|td|th|blockquote|center|li|span)[^>]*>([\s\S]*?)<\/\4\s*>|<a[^>]*>([\s\S]*?)<\/a\s*>/gi;
    let m: RegExpExecArray | null;
    let matched = false;
    while ((m = re.exec(src)) !== null) {
      const listTag = (m[1] ?? "").toLowerCase();
      const listInner = m[2] ?? "";
      const soloTag = (m[3] ?? "").toLowerCase();
      const soloFull = m[0];
      const boxTag = (m[4] ?? "").toLowerCase();
      const boxInner = (m[5] ?? "").trim();
      const anchorInner = (m[6] ?? "").trim();
      if (listTag === "ul" || listTag === "ol") {
        matched = true;
        const items = [...listInner.matchAll(/<li[^>]*>([\s\S]*?)<\/li\s*>/gi)]
          .map((x) => toPlainText(x[1]))
          .filter(Boolean);
        const fallback = toPlainText(listInner);
        blocks.push({ id: newBlockId(), type: "list", items: items.length ? items : (fallback ? [fallback] : []) });
        continue;
      }
      if (soloTag === "img" || (!soloTag && !boxTag && anchorInner === "" && /<img/i.test(soloFull))) {
        matched = true;
        const srcM = soloFull.match(/src\s*=\s*"([^"]*)"/i) ?? soloFull.match(/src\s*=\s*'([^']*)'/i);
        const altM = soloFull.match(/alt\s*=\s*"([^"]*)"/i) ?? soloFull.match(/alt\s*=\s*'([^']*)'/i);
        const s = (srcM?.[1] ?? "").trim();
        if (!s) continue;
        blocks.push({ id: newBlockId(), type: "image", src: s, url: s, text: altM?.[1] ? unesc(altM[1]) : "" });
        continue;
      }
      if (soloTag === "hr") {
        matched = true;
        blocks.push({ id: newBlockId(), type: "divider" });
        continue;
      }
      if (boxTag === "h1" || boxTag === "h2" || boxTag === "h3") {
        matched = true;
        const text = toPlainText(boxInner);
        if (!text && !/\{\{/.test(boxInner)) continue;
        blocks.push({ id: newBlockId(), type: "heading", level: boxTag === "h1" ? 1 : boxTag === "h2" ? 2 : 3, text });
        continue;
      }
      if (boxTag) {
        matched = true;
        // Images nested inside containers (e.g. the logo <img> in a header
        // <td>) become their own image blocks so the logo is never lost
        // when parsing stored templates back into the visual builder.
        const nestedImgs = [...boxInner.matchAll(/<img[^>]*>/gi)];
        for (const ni of nestedImgs) {
          const tag = ni[0];
          const sM = tag.match(/src\s*=\s*"([^"]*)"/i) ?? tag.match(/src\s*=\s*'([^']*)'/i);
          const aM = tag.match(/alt\s*=\s*"([^"]*)"/i) ?? tag.match(/alt\s*=\s*'([^']*)'/i);
          const s = (sM?.[1] ?? "").trim();
          if (s) blocks.push({ id: newBlockId(), type: "image", src: s, url: s, text: aM?.[1] ? unesc(aM[1]) : "" });
        }
        const boxRest = boxInner.replace(/<img[^>]*>/gi, " ");
        // Skip pure layout wrappers with no readable text (empty spacers vanish).
        const textOnly = toPlainText(boxRest);
        if (!textOnly && !/\{\{/.test(boxRest)) continue;
        // Standalone CTA link inside a container becomes a button block.
        const linkM = boxRest.match(/<a[^>]*href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)[^>]*>([\s\S]*?)<\/a\s*>/i);
        if (linkM) {
          const rawHref = (linkM[1] ?? "").replace(/^["']|["']$/g, "");
          const label = toPlainText(linkM[2]);
          const rest = toPlainText(boxRest.replace(linkM[0], " "));
          if ((/padding|background/i.test(boxRest) || /verify|reset|confirm|open|start|explore/i.test(`${label} ${rawHref}`)) && label && rest.length < 40) {
            blocks.push({ id: newBlockId(), type: "button", text: label, url: rawHref || "#" });
            if (rest) blocks.push({ id: newBlockId(), type: "paragraph", text: rest });
            continue;
          }
          if (!rest && label) {
            const isCta = /padding|background/i.test(boxRest);
            blocks.push({ id: newBlockId(), type: isCta ? "button" : "link", text: label, url: rawHref || "#" });
            continue;
          }
        }
        // Nested list inside a container: split out as its own block.
        if (/<li[\s>]/i.test(boxRest)) {
          const items = [...boxRest.matchAll(/<li[^>]*>([\s\S]*?)<\/li\s*>/gi)]
            .map((x) => toPlainText(x[1]))
            .filter(Boolean);
          const before = toPlainText(boxRest.replace(/<ul[\s\S]*<\/ul\s*>/gi, " ").replace(/<ol[\s\S]*<\/ol\s*>/gi, " "));
          if (before) blocks.push({ id: newBlockId(), type: "paragraph", text: before });
          if (items.length) blocks.push({ id: newBlockId(), type: "list", items });
          continue;
        }
        // Skip containers that only wrap other blocks already captured
        // (prevents duplicate wrapper paragraphs around tables).
        if (/<(h1|h2|h3|p|ul|ol|img|hr|a)[\s>]/i.test(boxRest) && textOnly.length > 300) continue;
        blocks.push({ id: newBlockId(), type: boxTag === "li" ? "paragraph" : "paragraph", text: textOnly });
        continue;
      }
      // Bare <a> outside any container.
      if (anchorInner !== "" || /<a/i.test(soloFull)) {
        matched = true;
        const hrefM = soloFull.match(/href\s*=\s*"([^"]*)"/i) ?? soloFull.match(/href\s*=\s*'([^']*)'/i);
        const label = toPlainText(anchorInner) || (hrefM?.[1] ?? "Open");
        if (/padding|background:#00A862/i.test(soloFull)) blocks.push({ id: newBlockId(), type: "button", text: label, url: hrefM?.[1] ?? "#" });
        else blocks.push({ id: newBlockId(), type: "link", text: label, url: hrefM?.[1] ?? "#" });
        continue;
      }
    }
    if (!matched) {
      const text = toPlainText(src);
      if (text) return [{ id: newBlockId(), type: "paragraph", text }];
      return [{ id: newBlockId(), type: "paragraph", text: "" }];
    }
    // Merge consecutive spacers/empties; drop empty non-spacer blocks.
    const cleaned = blocks.filter((b) => {
      if (b.type === "list") return (b.items ?? []).length > 0;
      if (b.type === "image") return Boolean((b.src ?? b.url ?? "").trim());
      if (b.type === "divider") return true;
      return Boolean((b.text ?? b.url ?? "").trim());
    });
    return cleaned.length ? cleaned : [{ id: newBlockId(), type: "paragraph", text: "" }];
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
