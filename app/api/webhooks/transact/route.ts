import { NextRequest, NextResponse } from "next/server";
import { TRANSACT_CONFIG } from "@/app/lib/integrations/transact";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-transact-signature");
    if (!signature || signature !== TRANSACT_CONFIG.webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    console.log("Transact webhook received:", body.event, body.payload);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
