import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getUserFromRequest } from "@/app/lib/utils/auth";

export async function GET() {
  try {
    const user = await getUserFromRequest() as { id: string; googleId: string | null; password: string } | null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const hasGoogle = !!user.googleId;
    const hasPassword = !!user.password && user.password.length > 0;
    return NextResponse.json({ hasGoogle, hasPassword }, { status: 200 });
  } catch (error) {
    console.error("Link status error:", error);
    Sentry.captureException(error);
    if (error instanceof Error && (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientInitializationError")) {
      return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
