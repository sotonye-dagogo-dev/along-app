"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BUG_REPORT_FIELDS } from "@/app/lib/config";
import { ConfigDrivenForm } from "@/app/components/ui/ConfigDrivenForm";
import { AppEmptyState } from "@/app/components/ui/AppEmptyState";
import { ReportImageUpload } from "@/app/components/features/moderation";
import { CheckCircle } from "lucide-react";

function ReportBugForm() {
  const [submitted, setSubmitted] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stable idempotency key per form instance: retries / double-clicks after
  // a timeout present the same key so the API dedups instead of duplicating.
  const [clientToken] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const searchParams = useSearchParams();

  // Prefill from error boundaries (sanitized ?title=&description=): fed into
  // the form's existing initialValues so the reporter keeps the capture and
  // adds their own details above or below it. Query-only — never throws.
  const initialValues = useMemo(() => {
    const values: Record<string, string> = {};
    try {
      const title = searchParams.get("title");
      const description = searchParams.get("description");
      const category = searchParams.get("category");
      if (title) values.title = title.slice(0, 200);
      if (description) values.description = description.slice(0, 10000);
      if (category) values.category = category;
    } catch {
      /* query unreadable — plain form */
    }
    return values;
  }, [searchParams]);

  const hasPrefill = Boolean(initialValues.title || initialValues.description);

  const handleSubmit = async (_data: Record<string, unknown>) => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": clientToken,
        },
        body: JSON.stringify({ ..._data, clientToken, ...(images.length > 0 ? { images } : {}) }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error((payload as { error?: string } | null)?.error ?? "Submission failed. Please try again.");
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-[480px] mx-auto px-4 py-12">
        <AppEmptyState
          icon={CheckCircle}
          title="Bug report submitted"
          description="Thanks for helping improve Along. Our team will review your report."
        />
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5">Report a Bug</h1>
      <p className="text-sm text-text-secondary mb-6">
        Help us improve Along by reporting issues you encounter.
      </p>
      {hasPrefill && (
        <p className="text-xs text-text-secondary bg-bg-elevated border border-border radius-md px-3 py-2.5 mb-5" role="note">
          We prefilled what the app captured about the error below — you can
          add your own details above or below it. Please keep the prefilled
          summary so our team has context.
        </p>
      )}
      <ConfigDrivenForm
        fields={BUG_REPORT_FIELDS}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        submitLabel={sending ? "Submitting…" : "Submit Report"}
        isLoading={sending}
        beforeSubmit={
          <ReportImageUpload images={images} onChange={setImages} disabled={sending} />
        }
      />
      {error && (
        <p role="alert" className="mt-3 text-sm text-error-text bg-error radius-md px-3 py-2.5">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ReportBugPage() {
  return (
    <Suspense>
      <ReportBugForm />
    </Suspense>
  );
}
