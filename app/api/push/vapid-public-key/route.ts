import { NextResponse } from "next/server";

export async function GET() {
  // Sender (pushSender.ts + /api/push/send) accepts both names — the client
  // must too. Prod commonly sets only NEXT_PUBLIC_VAPID_PUBLIC_KEY, which
  // previously surfaced as "" here → silent "no-vapid" failures on Enable.
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  return NextResponse.json({ publicKey }, { status: 200 });
}
