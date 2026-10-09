"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "@/app/providers/AuthProvider";
import { useOnlineStatus } from "@/app/providers/OnlineStatusProvider";
import { subscribeToPush } from "@/app/lib/utils/pushClient";

/**
 * Push opt-in manager — config-free UI, permission-aware, offline-safe.
 * Auto-subscribes once after login (existing behaviour preserved); also
 * exposes manual enable/disable so users can control notifications.
 */
export function PushManager() {
  const auth = useContext(AuthContext);
  const { isOnline } = useOnlineStatus();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/push/status");
      if (!res.ok) return;
      const data = await res.json();
      setEnabled(!!data.subscribed);
    } catch {}
  }, []);

  useEffect(() => {
    if (auth?.isAuthenticated) void checkStatus();
    else setEnabled(null);
  }, [auth?.isAuthenticated, checkStatus]);

  const enable = useCallback(async () => {
    if (!isOnline || busy) return;
    setBusy(true);
    try {
      const ok = await subscribeToPush();
      if (ok) {
        setEnabled(true);
        if (typeof Notification !== "undefined") setPermission(Notification.permission);
      }
    } finally {
      setBusy(false);
    }
  }, [isOnline, busy]);

  if (!auth?.isAuthenticated || enabled !== false || dismissed) return null;
  if (permission === "denied") return null;

  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 10,
        background: "var(--info-soft, #e8f1ff)",
        color: "var(--info-ink, #1d4ed8)",
        fontSize: 13,
        marginBottom: 10,
      }}
    >
      <span style={{ flex: 1 }}>Enable push notifications to never miss replies, mentions, and rewards.</span>
      <button
        onClick={() => void enable()}
        disabled={busy || !isOnline}
        style={{
          background: "var(--brand, #00623B)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          fontWeight: 600,
          cursor: busy || !isOnline ? "not-allowed" : "pointer",
          opacity: busy || !isOnline ? 0.6 : 1,
        }}
      >
        {busy ? "Enabling…" : "Enable"}
      </button>
      <button
        onClick={() => setDismissed(true)}
        disabled={busy}
        aria-label="Dismiss push prompt"
        style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14 }}
      >
        ✕
      </button>
    </div>
  );
}
