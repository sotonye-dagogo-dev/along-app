"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { toastService } from "@/app/lib/services/toastService";
import {
  AppTable,
  AppTag,
  AppEmptyState,
  AppInput,
  AppSelect,
  AppButton,
  AppCard,
  type Column,
} from "@/app/components/ui";
import {
  AUDIT_DISPLAY_CONFIG,
  sanitizeAuditText,
  sanitizeAuditDetails,
  auditEntityMeta,
  auditActionMeta,
} from "@/app/lib/config";

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

interface AuditRow extends Record<string, unknown> {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorLabel: string;
  createdLabel: string;
  entry: AuditEntry;
}

/** Best-effort date label — never throws on exotic values. */
function formatAuditDate(raw: unknown): string {
  try {
    const d = new Date(String(raw ?? ""));
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function toRow(e: AuditEntry): AuditRow {
  const actorLabel = e.actor
    ? `@${sanitizeAuditText(e.actor.userName, 40) || "user"} (${sanitizeAuditText(e.actor.email, 60) || "no email"})`
    : sanitizeAuditText(e.actorId, 40) || AUDIT_DISPLAY_CONFIG.systemActorLabel;
  return {
    id: e.id,
    action: sanitizeAuditText(e.action, 60) || "unknown",
    entity: sanitizeAuditText(e.entity, 40) || "general",
    entityId: typeof e.entityId === "string" ? sanitizeAuditText(e.entityId, 24) : null,
    actorLabel,
    createdLabel: formatAuditDate(e.createdAt),
    entry: e,
  };
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
      if (action.trim()) params.set("action", action.trim());
      params.set("limit", String(AUDIT_DISPLAY_CONFIG.pageSize));
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) throw new Error("Load failed");
      const data = await res.json();
      setEntries((prev) => (reset ? data.entries ?? [] : [...prev, ...(data.entries ?? [])]));
      setNextCursor(data.nextCursor ?? null);
    } catch {
      toastService.error(AUDIT_DISPLAY_CONFIG.loadError);
    } finally {
      setLoading(false);
    }
  }, [entity, action, nextCursor]);

  useEffect(() => { load(true); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => entries.map(toRow), [entries]);

  const columns: Column<AuditRow>[] = useMemo(() => [
    {
      key: "action",
      label: AUDIT_DISPLAY_CONFIG.columns.action,
      sortable: true,
      render: (_value, row) => {
        const meta = auditActionMeta(row.entry.action);
        return (
          <AppTag variant={meta.variant} size="xs">
            {meta.label}
          </AppTag>
        );
      },
    },
    {
      key: "entity",
      label: AUDIT_DISPLAY_CONFIG.columns.entity,
      sortable: true,
      render: (_value, row) => {
        const meta = auditEntityMeta(row.entry.entity);
        return (
          <AppTag variant={meta.variant} size="xs">
            {row.entityId ? `${meta.label} · ${row.entityId}` : meta.label}
          </AppTag>
        );
      },
    },
    {
      key: "actorLabel",
      label: AUDIT_DISPLAY_CONFIG.columns.actor,
      render: (value) => (
        <span className="block max-w-[220px] truncate text-text-secondary" title={String(value ?? "")}>
          {String(value ?? "")}
        </span>
      ),
    },
    {
      key: "id",
      label: AUDIT_DISPLAY_CONFIG.columns.details,
      render: (_value, row) => {
        const { chips, overflow, fullText } = sanitizeAuditDetails(row.entry.metadata);
        if (chips.length === 0) return <span className="text-text-muted">—</span>;
        return (
          <span className="flex flex-wrap items-center gap-1">
            {chips.map((c) => (
              <AppTag key={c.key} variant="muted" size="xs">
                {c.key}: {c.value}
              </AppTag>
            ))}
            {overflow > 0 && <AppTag variant="default" size="xs">+{overflow} more</AppTag>}
            {fullText && (
              <details className="text-[11px] text-text-muted">
                <summary className="cursor-pointer hover:text-text-primary">full</summary>
                <pre className="mt-1 max-w-[320px] whitespace-pre-wrap break-words rounded bg-bg-elevated p-2 font-mono text-[11px] text-text-secondary">
                  {fullText}
                </pre>
              </details>
            )}
          </span>
        );
      },
    },
    {
      key: "createdLabel",
      label: AUDIT_DISPLAY_CONFIG.columns.date,
      sortable: true,
      render: (value) => (
        <span className="whitespace-nowrap text-text-muted">{String(value ?? "")}</span>
      ),
    },
  ], []);

  if (loading) {
    return (
      <div className="min-w-0 flex flex-col gap-4">
        <div>
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight">{AUDIT_DISPLAY_CONFIG.title}</h1>
          <div className="text-sm text-text-secondary">{AUDIT_DISPLAY_CONFIG.subtitle}</div>
        </div>
        <AppCard>
          <AppTable columns={columns} data={[]} isLoading />
        </AppCard>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight">{AUDIT_DISPLAY_CONFIG.title}</h1>
          <div className="text-sm text-text-secondary">{AUDIT_DISPLAY_CONFIG.subtitle}</div>
        </div>
        <AppButton variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => load(true)}>
          {AUDIT_DISPLAY_CONFIG.reloadLabel}
        </AppButton>
      </div>

      <AppCard className="flex flex-col gap-3 sm:flex-row sm:items-end p-4">
        <AppSelect
          label="Entity"
          aria-label="Filter by entity"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          options={[
            { value: "", label: AUDIT_DISPLAY_CONFIG.allEntitiesLabel },
            ...AUDIT_DISPLAY_CONFIG.entities.map((e) => ({ value: e.value, label: e.label })),
          ]}
          wrapperClassName="sm:w-52"
        />
        <AppInput
          label="Action"
          aria-label="Filter by action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder={AUDIT_DISPLAY_CONFIG.actionFilterPlaceholder}
          wrapperClassName="sm:flex-1"
        />
        <AppButton variant="primary" size="md" onClick={() => load(true)}>
          {AUDIT_DISPLAY_CONFIG.applyLabel}
        </AppButton>
      </AppCard>

      <AppCard className="p-0 overflow-hidden">
        <AppTable
          columns={columns}
          data={rows}
          rowKey="id"
          stickyHeader
          emptyState={
            <AppEmptyState
              icon={ScrollText}
              title={AUDIT_DISPLAY_CONFIG.emptyTitle}
              description={AUDIT_DISPLAY_CONFIG.emptyDescription}
            />
          }
        />
      </AppCard>

      {nextCursor && (
        <AppButton variant="secondary" size="sm" onClick={() => load(false)} className="self-center">
          {AUDIT_DISPLAY_CONFIG.loadMoreLabel}
        </AppButton>
      )}
    </div>
  );
}
