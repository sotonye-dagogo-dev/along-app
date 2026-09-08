import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { prisma } from "@/app/lib/db/prisma";

function ensureVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const priv = process.env.VAPID_PRIVATE_KEY ?? "";
  const mail = process.env.VAPID_MAILTO ?? "mailto:support@along.app";
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(mail, pub, priv);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!ensureVapid()) {
      return NextResponse.json({ error: "Push not configured" }, { status: 503 });
    }
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.QSTASH_TOKEN}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, title, body: messageBody, url } = body;

    if (!userId || !title) {
      return NextResponse.json({ error: "userId and title required" }, { status: 400 });
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({ sent: 0 }, { status: 200 });
    }

    const payload = JSON.stringify({
      title,
      body: messageBody ?? "",
      url: url ?? "/notifications",
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        ),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      const expiredEndpoints: string[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "rejected" && r.reason?.statusCode === 410) {
          expiredEndpoints.push(subscriptions[i].endpoint);
        }
      }
      if (expiredEndpoints.length > 0) {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: { in: expiredEndpoints } },
        });
      }
    }

    return NextResponse.json({ sent, failed }, { status: 200 });
  } catch (error) {
    console.error("Push send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
