import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { prisma } from "@/app/lib/db/prisma";

export async function GET() {
  try {
    const session = await getUserFromRequest() as { id: string } | null;
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    // Re-read auth methods from the DB on every call (never trust — or leak —
    // the password hash via the session helper). Only booleans leave this
    // route, so linking/unlinking persists and both panels reflect reality
    // even after reloads or cross-device changes.
    const dbUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: { googleId: true, password: true },
    });
    if (!dbUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const hasGoogle = !!dbUser.googleId;
    const hasPassword = !!dbUser.password && dbUser.password.length > 0;
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
