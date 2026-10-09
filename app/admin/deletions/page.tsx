"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, UserX } from "lucide-react";
import { toastService } from "@/app/lib/services/toastService";

interface DeletionRequest {
  id: string;
  userId: string;
  status: "PENDING" | "CANCELLED" | "COMPLETED";
  reason?: string | null;
  originalEmail: string;
  originalUserName: string;
  requestedAt: string;
  scheduledFor: string;
  cancelledAt?: string | null;
  completedAt?: string | null;
  user?: { id: string; userName: string; firstName: string; lastName: string; email: string; isDeleted: boolean } | null;
}

const FILTERS = [
  { id: "", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "COMPLETED", label: "Completed" },
] as const;

/**
 * Admin deletions queue: pending grace-period requests, history, and a
 * manual "finalize due" trigger (same safe pipeline as the cron).
 */
export default function AdminDeletionsPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : "";
      const res = await fetch(`/api/admin/deletions${qs}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
        setPendingCount(data.pendingCount ?? 0);
      }
    } catch {
      toastService.error("Failed to load deletion requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter || undefined); }, [filter, load]);

  const handleFinalize = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/deletions/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalizeDue" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Finalize failed");
      toastService.success(`Finalized ${(data as { processed?: number }).processed ?? 0} due request(s)`);
      await load(filter || undefined);
    } catch (e) {
      toastService.error(e instanceof Error ? e.message : "Finalize failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight truncate flex items-center gap-2">
            <UserX size={22} className="shrink-0 text-text-secondary" />
            Deletions
          </h1>
          <div className="text-sm text-text-secondary truncate">
            {pendingCount} pending · 7-day grace → anonymize (posts retained, likes/bookmarks removed)
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Status filter">
            {FILTERS.map((f) => (
              <button
                key={f.id || "all"}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1.5 radius-md text-xs font-medium cursor-pointer border transition-colors ${
                  filter === f.id ? "bg-primary-muted text-primary border-primary" : "bg-bg-card text-text-secondary border-border"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(filter || undefined)}
            className="inline-flex items-center gap-1.5 px-3 py-2 radius-md border border-border bg-bg-card text-xs font-medium text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={handleFinalize}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 radius-md border-none bg-primary text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            {busy ? "Finalizing…" : "Finalize due now"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto radius-lg border border-border bg-bg-card shadow-xs max-w-full">
        <table className="w-full border-collapse text-xs min-w-[760px]">
          <thead>
            <tr className="bg-bg-elevated">
              {["User", "Status", "Requested", "Scheduled", "Reason", "Profile"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left whitespace-nowrap border-b border-border-strong">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-text-muted">Loading…</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-text-muted">No deletion requests</td></tr>
            ) : requests.map((r) => (
              <tr key={r.id} className="hover:bg-bg-elevated transition-colors">
                <td className="px-4 py-3 border-b border-border">
                  <div className="font-semibold text-text-primary truncate max-w-[220px]">
                    {r.user ? `${r.user.firstName} ${r.user.lastName}` : r.originalUserName}
                  </div>
                  <div className="text-[10px] text-text-muted truncate">@{r.originalUserName} · {r.originalEmail}</div>
                </td>
                <td className="px-4 py-3 border-b border-border whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 radius-pill text-[10px] font-semibold ${
                    r.status === "PENDING" ? "bg-warning text-warning-text"
                    : r.status === "COMPLETED" ? "bg-bg-elevated text-text-muted"
                    : "bg-info text-info-text"
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 border-b border-border text-text-muted whitespace-nowrap">{new Date(r.requestedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 border-b border-border text-text-muted whitespace-nowrap">{new Date(r.scheduledFor).toLocaleDateString()}</td>
                <td className="px-4 py-3 border-b border-border max-w-[240px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</td>
                <td className="px-4 py-3 border-b border-border whitespace-nowrap">
                  <Link href={`/profile/${encodeURIComponent(r.originalUserName)}`} className="text-primary text-xs font-medium no-underline hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted leading-relaxed">
        Recovery note: backups are kept up to 30 days. Account recovery within that window is handled off-platform
        from database backups — contact the user’s original email and restore manually.
      </p>
    </div>
  );
}
