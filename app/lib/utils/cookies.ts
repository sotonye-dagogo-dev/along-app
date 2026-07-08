import { cookies } from "next/headers";

const ACCESS_MAX_AGE_DEFAULT = 3600;
const ACCESS_MAX_AGE_REMEMBER = 604800;
const REFRESH_MAX_AGE_DEFAULT = 604800;
const REFRESH_MAX_AGE_REMEMBER = 2592000;

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  rememberMe?: boolean
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: rememberMe ? ACCESS_MAX_AGE_REMEMBER : ACCESS_MAX_AGE_DEFAULT,
  });

  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: rememberMe ? REFRESH_MAX_AGE_REMEMBER : REFRESH_MAX_AGE_DEFAULT,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set("access_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  cookieStore.set("refresh_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
