import jwt from "jsonwebtoken";
import { prisma } from "@/app/lib/db/prisma";
import { cookies } from "next/headers";
function resolveSecret(envKey: string, fallbacks: string[], devDefault: string): string {
  const val = (process.env[envKey] as string | undefined) || fallbacks.map((k) => process.env[k] as string | undefined).find(Boolean);
  if (!val && process.env.NODE_ENV === "production") {
    console.error(`${envKey} missing in production — using insecure fallback. Set ${envKey} env var.`);
  }
  return val || devDefault;
}
const JWT_SECRET = resolveSecret("JWT_SECRET", ["JWT_ACCESS_SECRET"], "dev-jwt-secret");
// Do not expose JWT via NEXT_PUBLIC_*; warn if present to prevent secret leak
if (process.env.NEXT_PUBLIC_JWT_SECRET && process.env.NODE_ENV === "production") {
  console.warn("NEXT_PUBLIC_JWT_SECRET is set — this exposes JWT secret to the client. Remove it.");
}
const JWT_REFRESH_SECRET = resolveSecret("JWT_REFRESH_SECRET", ["JWT_SECRET", "JWT_ACCESS_SECRET"], "dev-refresh-secret");

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
