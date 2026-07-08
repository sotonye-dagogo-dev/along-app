import { NextRequest, NextResponse } from "next/server";
import { TEGA_CONFIG } from "@/app/lib/integrations/tega";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-tega-signature");
    if (!signature || signature !== TEGA_CONFIG.apiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    console.log("Tega webhook received:", body.event, body.payload);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
