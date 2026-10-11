/**
 * Audit-trail display configuration (config-driven, zero app deps).
 * Drives the admin Audit page: entity/action label + AppTag variant metadata,
 * filter options, and pure sanitizers so raw actor input, metadata JSON, or
 * exotic shapes can never break the UI or inject markup. Never throws.
 */

export type AuditTagVariant = "default" | "primary" | "success" | "warning" | "error" | "muted";

export interface AuditEntityMeta {
  value: string;
  label: string;
  variant: AuditTagVariant;
}

export interface AuditActionMeta {
  /** Prefix match (e.g. "post" covers "post.edit", "post.delete"). */
  prefix: string;
  label: string;
  variant: AuditTagVariant;
}

export interface AuditDisplayConfig {
  title: string;
  subtitle: string;
  reloadLabel: string;
  applyLabel: string;
  loadMoreLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  loadError: string;
  allEntitiesLabel: string;
  actionFilterPlaceholder: string;
  pageSize: number;
  /** Max metadata key=value chips shown inline before collapsing into details. */
  inlineDetailLimit: number;
  /** Hard caps so a single hostile row can't blow out the layout. */
  maxTextLength: number;
  maxMetadataChars: number;
  entities: AuditEntityMeta[];
  actions: AuditActionMeta[];
  fallbackEntityVariant: AuditTagVariant;
  fallbackActionVariant: AuditTagVariant;
  columns: {
    action: string;
    entity: string;
    actor: string;
    details: string;
    date: string;
  };
  systemActorLabel: string;
}

export const AUDIT_DISPLAY_CONFIG: AuditDisplayConfig = {
  title: "Audit Trail",
  subtitle: "Who did what, when — across users, emails, blogs, moderation",
  reloadLabel: "Reload",
  applyLabel: "Apply",
  loadMoreLabel: "Load more",
  emptyTitle: "No audit entries yet",
  emptyDescription: "Admin actions across the platform will appear here.",
  loadError: "Failed to load audit trail",
  allEntitiesLabel: "All entities",
  actionFilterPlaceholder: "Filter by action…",
  pageSize: 20,
  inlineDetailLimit: 4,
  maxTextLength: 120,
  maxMetadataChars: 2000,
  entities: [
    { value: "post", label: "Post", variant: "primary" },
    { value: "user", label: "User", variant: "success" },
    { value: "email-template", label: "Email", variant: "warning" },
    { value: "blog", label: "Blog", variant: "primary" },
    { value: "bug", label: "Report", variant: "error" },
    { value: "deletion", label: "Deletion", variant: "error" },
  ],
  actions: [
    { prefix: "post.edit", label: "Post edited", variant: "primary" },
    { prefix: "post.delete", label: "Post deleted", variant: "error" },
    { prefix: "post.archive", label: "Post archived", variant: "warning" },
    { prefix: "post.restore", label: "Post restored", variant: "success" },
    { prefix: "user.", label: "User change", variant: "success" },
    { prefix: "blog.", label: "Blog change", variant: "primary" },
    { prefix: "email.", label: "Email change", variant: "warning" },
  ],
  fallbackEntityVariant: "muted",
  fallbackActionVariant: "default",
  columns: {
    action: "Action",
    entity: "Entity",
    actor: "Actor",
    details: "Details",
    date: "Date",
  },
  systemActorLabel: "system",
};

/** Strip tags / decode the common entities / collapse whitespace. Never throws. */
export function sanitizeAuditText(raw: unknown, maxLen = AUDIT_DISPLAY_CONFIG.maxTextLength): string {
  try {
    const text = String(raw ?? "")
      .replace(/<script[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
  } catch {
    return "";
  }
}

export interface AuditDetailChip {
  key: string;
  value: string;
}

/**
 * Flatten audit metadata into sanitized key=value chips for inline display.
 * Plain objects only; arrays collapse to a count; nested objects stringify
 * (capped) rather than recursing, so exotic JSON shapes can't break the UI.
 */
export function sanitizeAuditDetails(
  metadata: unknown,
  limit = AUDIT_DISPLAY_CONFIG.inlineDetailLimit
): { chips: AuditDetailChip[]; overflow: number; fullText: string } {
  const empty = { chips: [] as AuditDetailChip[], overflow: 0, fullText: "" };
  try {
    if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return empty;
    const record = metadata as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 0) return empty;
    const all: AuditDetailChip[] = keys.slice(0, 50).map((k) => {
      const v = record[k];
      let text: string;
      if (v === null || v === undefined) text = "—";
      else if (typeof v === "string") text = sanitizeAuditText(v, 80) || "—";
      else if (typeof v === "number" || typeof v === "boolean") text = String(v);
      else if (Array.isArray(v)) text = `${v.length} item${v.length === 1 ? "" : "s"}`;
      else text = sanitizeAuditText(JSON.stringify(v), 80) || "—";
      return { key: sanitizeAuditText(k, 40) || "field", value: text };
    });
    const chips = all.slice(0, Math.max(1, limit));
    let fullText = "";
    try {
      fullText = sanitizeAuditText(
        JSON.stringify(record, null, 1),
        AUDIT_DISPLAY_CONFIG.maxMetadataChars
      );
    } catch {
      fullText = "";
    }
    return { chips, overflow: Math.max(0, all.length - chips.length), fullText };
  } catch {
    return empty;
  }
}

/** Resolve the display label + tag variant for an entity value. */
export function auditEntityMeta(entity: string): { label: string; variant: AuditTagVariant } {
  const found = AUDIT_DISPLAY_CONFIG.entities.find((e) => e.value === entity);
  if (found) return { label: found.label, variant: found.variant };
  const clean = sanitizeAuditText(entity, 40);
  return { label: clean || "Other", variant: AUDIT_DISPLAY_CONFIG.fallbackEntityVariant };
}

/** Resolve the display label + tag variant for an action value (prefix match). */
export function auditActionMeta(action: string): { label: string; variant: AuditTagVariant } {
  const found = AUDIT_DISPLAY_CONFIG.actions.find((a) => action.startsWith(a.prefix));
  if (found) return { label: found.label, variant: found.variant };
  const clean = sanitizeAuditText(action, 60);
  return { label: clean || "Unknown", variant: AUDIT_DISPLAY_CONFIG.fallbackActionVariant };
}
