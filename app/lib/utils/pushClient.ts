import type { PushSubscribeReason } from "@/app/lib/config/pushPrompt";

export interface PushSupport {
  supported: boolean;
  reason: PushSubscribeReason | null;
}

export interface PushSubscribeResult {
  ok: boolean;
  reason: PushSubscribeReason;
  permission: NotificationPermission | null;
}

/** Read the current permission without throwing (SSR/private-mode safe). */
function currentPermission(): NotificationPermission | null {
  try {
    if (typeof Notification === "undefined") return null;
    return Notification.permission;
  } catch {
    return null;
  }
}

/**
 * Environment check — safe to call anywhere (SSR, insecure contexts, old
 * browsers). Never throws; reports a stable reason instead.
 */
export function getPushSupport(): PushSupport {
  try {
    if (typeof window === "undefined") return { supported: false, reason: "unsupported" };
    if (typeof Notification === "undefined") return { supported: false, reason: "unsupported" };
    if (!("serviceWorker" in navigator)) return { supported: false, reason: "no-service-worker" };
    if (typeof (window as unknown as { PushManager?: unknown }).PushManager === "undefined") {
      return { supported: false, reason: "unsupported" };
    }
    // Web Push requires a secure context (https or localhost). Without it,
    // subscribe() rejects — report it instead of failing silently.
    const isSecure =
      window.isSecureContext ??
      (typeof window.location !== "undefined" &&
        (window.location.protocol === "https:" ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"));
    if (!isSecure) return { supported: false, reason: "insecure-context" };
    return { supported: true, reason: null };
  } catch {
    return { supported: false, reason: "unsupported" };
  }
}

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    if (!("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return reg;
  } catch {
    return null;
  }
}

/**
 * Explicit permission request — must run inside a user gesture on most
 * browsers. Returns the resulting permission (never throws).
 */
export async function ensurePushPermission(): Promise<NotificationPermission | null> {
  try {
    if (typeof Notification === "undefined") return null;
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      return Notification.permission;
    }
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return currentPermission();
  }
}

/**
 * Detailed subscribe — every failure maps to a stable reason + current
 * permission so the UI can instruct instead of going silent. Never throws.
 */
export async function subscribeToPushDetailed(): Promise<PushSubscribeResult> {
  const support = getPushSupport();
  if (!support.supported) {
    return { ok: false, reason: support.reason ?? "unsupported", permission: currentPermission() };
  }
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { ok: false, reason: "offline", permission: currentPermission() };
    }
  } catch { /* onLine best-effort */ }

  // Permission first: subscribing without it rejects on most browsers.
  const permission = await ensurePushPermission();
  if (permission === "denied") {
    return { ok: false, reason: "denied", permission };
  }
  if (permission !== "granted") {
    return { ok: false, reason: "dismissed-permission", permission };
  }

  const publicKey = await getVapidPublicKey();
  if (!publicKey) return { ok: false, reason: "no-vapid", permission };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: "no-service-worker", permission };

  let subscription: PushSubscription | null = null;
  try {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  } catch {
    return { ok: false, reason: "subscribe-failed", permission: currentPermission() };
  }
  if (!subscription) return { ok: false, reason: "subscribe-failed", permission: currentPermission() };

  let subJson: { endpoint?: string | null; keys?: Record<string, string> };
  try {
    subJson = subscription.toJSON() as { endpoint?: string | null; keys?: Record<string, string> };
  } catch {
    return { ok: false, reason: "subscribe-failed", permission: currentPermission() };
  }
  if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
    return { ok: false, reason: "subscribe-failed", permission: currentPermission() };
  }

  try {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
      }),
    });
    if (!res.ok) return { ok: false, reason: "server-rejected", permission: currentPermission() };
  } catch {
    return { ok: false, reason: "offline", permission: currentPermission() };
  }
  return { ok: true, reason: "ok", permission: currentPermission() };
}

/** Backward-compatible boolean wrapper (existing callers unchanged). */
export async function subscribeToPush(): Promise<boolean> {
  const r = await subscribeToPushDetailed();
  return r.ok;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData.split("").map((c) => c.charCodeAt(0)));
}
