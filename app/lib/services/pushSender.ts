/**
 * Server-side push fan-out. Sends a Web Push payload to every live
 * subscription of a user. Never throws — push is non-critical and must never
 * break the in-app notification write that precedes it. Free, keyless-op
 * friendly: only needs the existing VAPID env pair, no third-party API.
 */
import webpush from "web-push";
import { prisma } from "@/app/lib/db/prisma";
import { resolvePushPayload } from "@/app/lib/config/pwa";

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const priv = process.env.VAPID_PRIVATE_KEY ?? "";
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(process.env.VAPID_MAILTO ?? "mailto:support@alongng.com", pub, priv);
    vapidReady = true;
    return true;
  } catch {
    return false;
  }
}

export interface FanOutInput {
  type: string;
  message: string;
  postId?: string;
  commentId?: string;
  recipientIds: string[];
}

/**
 * Fire-and-forget push mirror for an in-app notification. Resolves the
 * title/body/url from PWA_PUSH_MIRROR (unknown future types use the generic
 * fallback — forward-compatible by design). Prunes 410-gone subscriptions.
 */
export async function fanOutPush(input: FanOutInput): Promise<{ sent: number; failed: number }> {
  try {
    if (!ensureVapid()) return { sent: 0, failed: 0 };
    const ids = [...new Set(input.recipientIds.filter(Boolean))];
    if (ids.length === 0) return { sent: 0, failed: 0 };

    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } } });
    if (subs.length === 0) return { sent: 0, failed: 0 };

    const payload = JSON.stringify(
      resolvePushPayload(input.type, input.message, { postId: input.postId, commentId: input.commentId }),
    );

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ),
      ),
    );

    const expired = subs
      .filter((_, i) => {
        const r = results[i];
        return r.status === "rejected" && (r.reason as { statusCode?: number } | undefined)?.statusCode === 410;
      })
      .map((s) => s.endpoint);
    if (expired.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } }).catch(() => {});
    }

    return {
      sent: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    };
  } catch {
    return { sent: 0, failed: 0 };
  }
}
