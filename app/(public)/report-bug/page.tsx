"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BUG_REPORT_FIELDS } from "@/app/lib/config";
import { ConfigDrivenForm } from "@/app/components/ui/ConfigDrivenForm";
import { AppEmptyState } from "@/app/components/ui/AppEmptyState";
import { CheckCircle } from "lucide-react";

function ReportBugForm() {
  const [submitted, setSubmitted] = useState(false);
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
    try {
      await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(_data),
      });
    } catch {
      // handle silently
    } finally {
      setSubmitted(true);
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
        submitLabel="Submit Report"
      />
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
