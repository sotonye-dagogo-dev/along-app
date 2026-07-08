"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppButton } from "./";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const hasConsent = document.cookie
      .split("; ")
      .some((row) => row.startsWith("cookieConsent=true"));
    if (!hasConsent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    document.cookie = "cookieConsent=true;max-age=31536000;path=/";
    setDismissed(true);
    setTimeout(() => setVisible(false), 200);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-bg-card border-t border-border shadow-lg p-4 transition-all duration-200 ease-out ${
        dismissed ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
      style={
        !dismissed
          ? { animation: "cookieUp 200ms ease-out forwards" }
          : undefined
      }
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-screen-xl mx-auto">
        <p className="text-sm text-text-secondary">
          Along uses necessary cookies to keep you signed in and improve your
          experience. By continuing to use Along, you accept this.{" "}
          <Link
            href="/privacy"
            className="text-primary hover:underline font-medium"
          >
            Privacy Policy
          </Link>
        </p>
        <AppButton
          variant="primary"
          size="sm"
          onClick={handleAccept}
          className="shrink-0"
        >
          Got it
        </AppButton>
      </div>
      <style>{`
        @keyframes cookieUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
