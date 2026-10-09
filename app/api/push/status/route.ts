import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { getUserSubscriptions } from "@/app/lib/services/pushSubscriptionService";

/** Whether the signed-in user has at least one live push subscription. */
export async function GET() {
  try {
    const user = await getUserFromRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const subs = await getUserSubscriptions(user.id as string);
    return NextResponse.json(
      { subscribed: subs.length > 0, count: subs.length },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
