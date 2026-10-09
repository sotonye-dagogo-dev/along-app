"use client";

/**
 * Route-drafts service — client-side multi-draft library backed by localStorage.
 *
 * Non-breaking by design: the previous single-key draft (`along_route_draft`)
 * is migrated into the collection on first read, so users never lose a saved
 * draft. Every method is never-throw (SSR-safe, corrupt-JSON-safe) following
 * the redis.ts fallback discipline.
 */
import { ROUTE_DRAFTS_CONFIG } from "@/app/lib/config/routeDrafts";

export interface RouteDraftStep {
  location: string;
  description: string;
  vehicle: string;
  fare: number;
  lat?: number;
  lng?: number;
}

export interface DraftResponseRef {
  id: string;
  title: string;
  user?: { userName: string; firstName: string; lastName: string };
  tags?: string[];
}

export interface RouteDraft {
  id: string;
  savedAt: string;
  title: string;
  description: string;
  steps: RouteDraftStep[];
  tags: string[];
  images: string[];
  /** Present when the draft was saved as a response to a route request. */
  responseTo?: DraftResponseRef | null;
}

export interface SaveDraftInput {
  title: string;
  description?: string;
  steps: RouteDraftStep[];
  tags: string[];
  images: string[];
  responseTo?: DraftResponseRef | null;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readRaw(key: string): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage full/blocked — drafts stay in memory only */
  }
}

function removeRaw(key: string): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(ROUTE_DRAFTS_CONFIG.changedEvent));
  } catch {
    /* ignore */
  }
}

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `draft_${crypto.randomUUID()}`;
    }
  } catch {
    /* fall through */
  }
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeSteps(raw: unknown): RouteDraftStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      location: typeof s.location === "string" ? s.location : "",
      description: typeof s.description === "string" ? s.description : "",
      vehicle: typeof s.vehicle === "string" ? s.vehicle : "",
      fare: typeof s.fare === "number" && Number.isFinite(s.fare) ? s.fare : 0,
      ...(typeof s.lat === "number" && Number.isFinite(s.lat) ? { lat: s.lat } : {}),
      ...(typeof s.lng === "number" && Number.isFinite(s.lng) ? { lng: s.lng } : {}),
    }))
    .filter((s) => s.location.trim().length > 0 || s.description.trim().length > 0);
}

function sanitizeStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string" && t.trim().length > 0).slice(0, 30);
}

function sanitizeResponseRef(raw: unknown): DraftResponseRef | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  const user =
    typeof r.user === "object" && r.user !== null
      ? (() => {
          const u = r.user as Record<string, unknown>;
          return {
            userName: typeof u.userName === "string" ? u.userName : "",
            firstName: typeof u.firstName === "string" ? u.firstName : "",
            lastName: typeof u.lastName === "string" ? u.lastName : "",
          };
        })()
      : undefined;
  return {
    id: r.id,
    title: typeof r.title === "string" ? r.title.slice(0, 100) : "",
    ...(user ? { user } : {}),
    ...(Array.isArray(r.tags) ? { tags: sanitizeStrings(r.tags) } : {}),
  };
}

function toDraft(raw: unknown): RouteDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const steps = sanitizeSteps(r.steps);
  return {
    id: typeof r.id === "string" && r.id ? r.id : makeId(),
    savedAt:
      typeof r.savedAt === "string" && r.savedAt ? r.savedAt : new Date().toISOString(),
    title: typeof r.title === "string" ? r.title.slice(0, 100) : "",
    description: typeof r.description === "string" ? r.description.slice(0, 500) : "",
    steps,
    tags: sanitizeStrings(r.tags),
    images: sanitizeStrings(r.images).slice(0, 10),
    responseTo: sanitizeResponseRef(r.responseTo),
  };
}

/** Migrate a legacy single-draft payload into the collection shape (null when empty). */
function legacyToDraft(raw: unknown): RouteDraft | null {
  const draft = toDraft(raw);
  if (!draft) return null;
  const hasContent =
    draft.title.trim().length > 0 || draft.steps.length > 0 || draft.images.length > 0;
  return hasContent ? draft : null;
}

function parseCollection(raw: string | null): RouteDraft[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(toDraft)
      .filter((d): d is RouteDraft => d !== null)
      .slice(0, ROUTE_DRAFTS_CONFIG.maxDrafts);
  } catch {
    return [];
  }
}

function persist(drafts: RouteDraft[]): void {
  writeRaw(ROUTE_DRAFTS_CONFIG.collectionKey, JSON.stringify(drafts));
  // Keep the legacy single-key in sync so older readers still see the latest draft.
  if (drafts.length > 0) {
    const latest = drafts[0];
    writeRaw(
      ROUTE_DRAFTS_CONFIG.legacyKey,
      JSON.stringify({
        title: latest.title,
        description: latest.description,
        steps: latest.steps,
        tags: latest.tags,
        images: latest.images,
        responseTo: latest.responseTo ?? null,
      })
    );
  } else {
    removeRaw(ROUTE_DRAFTS_CONFIG.legacyKey);
  }
}

export const routeDraftsService = {
  /** All drafts, newest first. Migrates legacy keys once, then clears them. */
  listDrafts(): RouteDraft[] {
    let drafts = parseCollection(readRaw(ROUTE_DRAFTS_CONFIG.collectionKey));
    if (drafts.length === 0) {
      const migrated: RouteDraft[] = [];
      for (const key of [ROUTE_DRAFTS_CONFIG.legacyKey, ROUTE_DRAFTS_CONFIG.legacyResponseKey]) {
        const raw = readRaw(key);
        if (!raw) continue;
        try {
          const draft = legacyToDraft(JSON.parse(raw));
          if (draft) migrated.push(draft);
        } catch {
          /* corrupt legacy payload — skip */
        }
      }
      if (migrated.length > 0) {
        drafts = migrated.slice(0, ROUTE_DRAFTS_CONFIG.maxDrafts);
        persist(drafts);
        removeRaw(ROUTE_DRAFTS_CONFIG.legacyResponseKey);
        notifyChanged();
      }
    }
    return drafts;
  },

  countDrafts(): number {
    return this.listDrafts().length;
  },

  getDraft(id: string): RouteDraft | null {
    return this.listDrafts().find((d) => d.id === id) ?? null;
  },

  hasUsableContent(input: SaveDraftInput): boolean {
    return (
      input.title.trim().length > 0 ||
      (input.description ?? "").trim().length > 0 ||
      input.steps.some((s) => s.location.trim().length > 0) ||
      input.images.length > 0 ||
      input.tags.length > 0
    );
  },

  /** Update an existing draft in place (same id, refreshed savedAt). Returns updated draft or null. */
  updateDraft(id: string, input: SaveDraftInput): RouteDraft | null {
    if (!this.hasUsableContent(input)) return null;
    const drafts = this.listDrafts();
    const idx = drafts.findIndex((d) => d.id === id);
    if (idx < 0) return this.saveDraft(input);
    const updated: RouteDraft = {
      id,
      savedAt: new Date().toISOString(),
      title: input.title.slice(0, 100),
      description: (input.description ?? "").slice(0, 500),
      steps: sanitizeSteps(input.steps),
      tags: sanitizeStrings(input.tags),
      images: sanitizeStrings(input.images).slice(0, 10),
      responseTo: sanitizeResponseRef(input.responseTo ?? null),
    };
    drafts[idx] = updated;
    // Most-recent-first: move the touched draft to the top.
    const [touched] = drafts.splice(idx, 1);
    persist([touched, ...drafts].slice(0, ROUTE_DRAFTS_CONFIG.maxDrafts));
    notifyChanged();
    return touched;
  },

  /** Save a new draft snapshot (newest first, capped). Returns the stored draft or null. */
  saveDraft(input: SaveDraftInput): RouteDraft | null {    if (!this.hasUsableContent(input)) return null;
    const draft: RouteDraft = {
      id: makeId(),
      savedAt: new Date().toISOString(),
      title: input.title.slice(0, 100),
      description: (input.description ?? "").slice(0, 500),
      steps: sanitizeSteps(input.steps),
      tags: sanitizeStrings(input.tags),
      images: sanitizeStrings(input.images).slice(0, 10),
      responseTo: sanitizeResponseRef(input.responseTo ?? null),
    };
    const drafts = [draft, ...this.listDrafts()].slice(0, ROUTE_DRAFTS_CONFIG.maxDrafts);
    persist(drafts);
    notifyChanged();
    return draft;
  },

  deleteDraft(id: string): RouteDraft[] {
    const drafts = this.listDrafts().filter((d) => d.id !== id);
    persist(drafts);
    notifyChanged();
    return drafts;
  },

  /** Remove legacy single keys without touching the collection (post-submit hygiene). */
  clearLegacyKeys(): void {
    removeRaw(ROUTE_DRAFTS_CONFIG.legacyKey);
    removeRaw(ROUTE_DRAFTS_CONFIG.legacyResponseKey);
  },
};
