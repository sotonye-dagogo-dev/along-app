import jwt from "jsonwebtoken";
import { prisma } from "@/app/lib/db/prisma";
import { cookies } from "next/headers";
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  process.env.NEXT_PUBLIC_JWT_SECRET ||
  "dev-jwt-secret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  process.env.JWT_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  "dev-refresh-secret";

interface JwtPayload {
  userId: string;
  role: string;
}

export function signAccessToken(payload: JwtPayload, rememberMe?: boolean): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: rememberMe ? "7d" : "1h" });
}

export function signRefreshToken(payload: JwtPayload, rememberMe?: boolean): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: rememberMe ? "30d" : "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
}

export async function getUserFromRequest(): Promise<Record<string, unknown> | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    if (!token) return null;

    const payload = verifyAccessToken(token);
    if (!payload?.userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        bio: true,
        location: true,
        verified: true,
        role: true,
        rewardPoints: true,
        rewardTier: true,
        inviteCode: true,
        invitedById: true,
        googleId: true,
        avatarConfig: true,
        lastKnownLat: true,
        lastKnownLng: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  } catch {
    return null;
  }
}
