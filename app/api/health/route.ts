import { NextResponse } from "next/server";

/** Lightweight heartbeat for the PWA offline detector (HEAD/GET, no auth, no DB). */
export async function GET() {
  return NextResponse.json({ ok: true, t: Date.now() }, { status: 200 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
