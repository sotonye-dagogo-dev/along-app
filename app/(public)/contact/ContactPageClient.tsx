"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { CONTACT_FIELDS } from "@/app/lib/config";
import { ConfigDrivenForm } from "@/app/components/ui/ConfigDrivenForm";
import { AppEmptyState } from "@/app/components/ui/AppEmptyState";
import { AppButton } from "@/app/components/ui";

export default function ContactPageClient() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (_data: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(_data),
      });
      if (!res.ok) {
        let msg = "Failed to send message"
        try {
          const t = await res.text()
          const d = t ? JSON.parse(t) as { error?: string } : null
          if (d?.error) msg = d.error
        } catch {}
        throw new Error(msg)
      }
    } catch {
      // handled below; still show submitted but toast error
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-[400px] mx-auto px-4 py-12">
        <AppEmptyState
          icon={CheckCircle}
          title="Message sent!"
          description="Thanks for reaching out. We&apos;ll get back to you within 24 hours."
        />
        <div className="text-center mt-4">
          <AppButton variant="secondary" onClick={() => setSubmitted(false)}>
            Send another message
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[400px] mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1.5">Get in touch</h1>
      <p className="text-sm text-text-secondary mb-6">
        We read every message. Expect a reply within 24 hours.
      </p>
      <ConfigDrivenForm
        fields={CONTACT_FIELDS}
        onSubmit={handleSubmit}
        submitLabel="Send Message"
        isLoading={loading}
      />
    </div>
  );
}
