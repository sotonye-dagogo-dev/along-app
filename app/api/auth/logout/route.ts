import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { clearAuthCookies } from "@/app/lib/utils/cookies";

export async function POST() {
  try {
    await clearAuthCookies();
    return NextResponse.json({ message: "Logged out" }, { status: 200 });
  } catch (error) {
    console.error("Logout error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
