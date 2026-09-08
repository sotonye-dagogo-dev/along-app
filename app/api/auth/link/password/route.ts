import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getUserFromRequest } from "@/app/lib/utils/auth";
import { hashPassword } from "@/app/lib/utils/security";
import { z } from "zod";

const Schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  currentPassword: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest() as { id: string; googleId: string | null; password: string } | null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }
    const { password, currentPassword } = parsed.data;

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const hasPassword = !!dbUser.password && dbUser.password.length > 0;

    // If user already has a password, require currentPassword verification (security)
    if (hasPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 });
      }
      const { verifyPassword } = await import("@/app/lib/utils/security");
      const valid = await verifyPassword(currentPassword, dbUser.password);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const hashed = await hashPassword(password);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    return NextResponse.json({ message: hasPassword ? "Password updated" : "Password added. You can now sign in with email and password." }, { status: 200 });
  } catch (error) {
    console.error("Link password error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
