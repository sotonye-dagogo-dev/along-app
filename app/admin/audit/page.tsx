"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toastService } from "@/app/lib/services/toastService";

interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  actor?: { id: string; userName: string; email: string } | null;
}

/** Type guard: AuditLog metadata is JSON — only plain objects render. */
function hasRenderableMetadata(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).length > 0;
}

/** Safe metadata preview — never throws on exotic JSON shapes. */
function formatMetadata(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value, null, 1);
  } catch {
    return "{}";
  }
}

/** Admin audit trail — who/what/when across platform mutations. */
export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entity) params.set("entity", entity);
      if (action) params.set("action", action);
      params.set("limit", "20");
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) throw new Error("Load failed");
      const data = await res.json();
      setEntries((prev) => (reset ? data.entries ?? [] : [...prev, ...(data.entries ?? [])]));
      setNextCursor(data.nextCursor ?? null);
    } catch {
      toastService.error("Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  }, [entity, action, nextCursor]);

  useEffect(() => { load(true); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="text-center py-12 text-text-muted">Loading audit trail…</div>;

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight">Audit Trail</h1>
          <div className="text-sm text-text-secondary">Who did what, when — across users, emails, blogs, moderation</div>
        </div>
        <button onClick={() => load(true)} className="inline-flex items-center gap-1.5 px-3 py-2 radius-md border border-border bg-bg-card text-xs font-medium cursor-pointer">
          <RefreshCw size={14} /> Reload
        </button>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        <select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Filter by entity"
          className="rounded-md border border-border bg-bg-card px-2 py-2">
          <option value="">All entities</option>
          {["user", "email-template", "blog", "post", "bug", "deletion"].map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Filter by action…"
          aria-label="Filter by action"
          className="rounded-md border border-border bg-bg-base px-2 py-2" />
        <button onClick={() => load(true)} className="px-3 py-2 radius-md bg-primary text-white font-semibold border-none cursor-pointer">Apply</button>
      </div>

      <div className="flex flex-col gap-1.5">
        {entries.length === 0 && <p className="text-sm text-text-muted py-8 text-center">No audit entries yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="px-4 py-3 rounded-lg bg-bg-card border border-border text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-primary">{e.action}</span>
              <span className="px-1.5 py-0.5 radius-pill bg-bg-elevated text-text-muted font-semibold">{e.entity}{e.entityId ? `:${e.entityId}` : ""}</span>
              <span className="ml-auto text-text-muted">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-1 text-text-secondary">
              Actor: {e.actor ? `@${e.actor.userName} (${e.actor.email})` : e.actorId ?? "system"}
            </div>
            {hasRenderableMetadata(e.metadata) && (
              <pre className="mt-1 p-2 rounded bg-bg-elevated font-mono text-[11px] whitespace-pre-wrap">{formatMetadata(e.metadata)}</pre>
            )}
          </div>
        ))}
      </div>

      {nextCursor && (
        <button onClick={() => load(false)} className="self-center px-4 py-2 radius-md border border-border text-xs font-semibold cursor-pointer">
          Load more
        </button>
      )}
    </div>
  );
}
