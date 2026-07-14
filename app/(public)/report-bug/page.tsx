"use client";

import { useState } from "react";
import { BUG_REPORT_FIELDS } from "@/app/lib/config";
import { ConfigDrivenForm } from "@/app/components/ui/ConfigDrivenForm";
import { AppEmptyState } from "@/app/components/ui/AppEmptyState";
import { CheckCircle } from "lucide-react";

export default function ReportBugPage() {
  const [submitted, setSubmitted] = useState(false);

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
      <ConfigDrivenForm
        fields={BUG_REPORT_FIELDS}
        onSubmit={handleSubmit}
        submitLabel="Submit Report"
      />
    </div>
  );
}
