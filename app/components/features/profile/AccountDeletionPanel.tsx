"use client";

import { useCallback, useEffect, useState } from "react";
import { TriangleAlert, Undo2 } from "lucide-react";
import { AppButton } from "@/app/components/ui";
import { toastService } from "@/app/lib/services/toastService";
import { modalService } from "@/app/lib/services/modalService";
import { ACCOUNT_DELETION_CONFIG } from "@/app/lib/config/accountDeletion";

interface PendingDeletion {
  id: string;
  requestedAt: string;
  scheduledFor: string;
  reason?: string | null;
}

/**
 * Self-service safe deletion panel (profile settings area).
 * Request → archived + 7-day grace → finalize. Reversible until due.
 * Config-driven copy (grace days from ACCOUNT_DELETION_CONFIG).
 */
export function AccountDeletionPanel() {
  const [pending, setPending] = useState<PendingDeletion | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/deletion-status");
      if (res.ok) {
        const data = await res.json();
        setPending(data.pending ?? null);
      }
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRequest = () => {
    modalService.confirm({
      title: "Request account deletion?",
      description: `Your account and posts will be archived immediately and permanently deleted after ${ACCOUNT_DELETION_CONFIG.gracePeriodDays} days. You can reverse this any time before then. Personal info is removed within ${ACCOUNT_DELETION_CONFIG.retentionDays} days; anonymised posts may be retained.`,
      variant: "destructive",
      confirmLabel: "Request deletion",
      onConfirm: () => {
        modalService.close();
        void (async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/account/delete-request", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: reason.slice(0, 500) }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
            toastService.success("Deletion requested — check your email");
            setReason("");
            await load();
          } catch (e) {
            toastService.error(e instanceof Error ? e.message : "Request failed");
          } finally {
            setBusy(false);
          }
        })();
      },
    });
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/account/cancel-deletion", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Reversal failed");
      }
      toastService.success("Deletion request reversed — welcome back!");
      await load();
    } catch (e) {
      toastService.error(e instanceof Error ? e.message : "Reversal failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  if (pending) {
    const due = new Date(pending.scheduledFor).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return (
      <section aria-label="Account deletion pending" className="mb-4 rounded-lg border border-warning-border bg-warning/10 p-4">
        <div className="flex items-start gap-2.5">
          <TriangleAlert size={18} className="shrink-0 text-warning-text mt-0.5" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-text-primary">Deletion scheduled for {due}</h3>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Your account and posts are archived and hidden. Reverse any time before {due} — after that your profile
              becomes “Deleted User” and likes/bookmarks are removed.
            </p>
            <div className="mt-3">
              <AppButton variant="secondary" onClick={handleCancel} disabled={busy} className="inline-flex items-center gap-1.5">
                <Undo2 size={14} />
                {busy ? "Reversing…" : "Reverse deletion request"}
              </AppButton>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Danger zone" className="mb-4 rounded-lg border border-border bg-bg-card p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-1">Danger zone</h3>
      <p className="text-xs text-text-secondary mb-3 leading-relaxed">
        Delete your account safely: archived immediately, permanently removed after {ACCOUNT_DELETION_CONFIG.gracePeriodDays} days
        (reversible until then).
      </p>
      <details className="mb-3">
        <summary className="text-xs font-medium text-text-secondary cursor-pointer hover:text-text-primary">
          Request account deletion
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <label htmlFor="deletion-reason" className="text-xs text-text-muted">
            Reason (optional, helps us improve)
          </label>
          <textarea
            id="deletion-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Optional reason…"
            className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div>
            <AppButton variant="secondary" onClick={handleRequest} disabled={busy} className="text-error-text border-error-border">
              {busy ? "Requesting…" : "Request deletion"}
            </AppButton>
          </div>
        </div>
      </details>
    </section>
  );
}
