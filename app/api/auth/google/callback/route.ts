import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/app/lib/db/prisma";
import { signAccessToken, signRefreshToken } from "@/app/lib/utils/auth";
import { setAuthCookies } from "@/app/lib/utils/cookies";
import { getAppUrl } from "@/app/lib/config/env";

export async function GET(request: NextRequest) {
  // All browser-visible failures redirect to a real page route (never a raw
  // /api JSON page) so a copied or refreshed address bar never strands a
  // user on an api route. `state=ref:<code>` is preserved where useful.
  const stateEarly = request.nextUrl.searchParams.get("state");
  const refEarly =
    stateEarly && stateEarly !== "link" && stateEarly.startsWith("ref:")
      ? stateEarly.slice("ref:".length).trim()
      : null;
  const refQuery = refEarly ? `?ref=${encodeURIComponent(refEarly)}` : "";
  const withRef = (page: string, error: string) =>
    `${getAppUrl()}${page}${refQuery ? `${refQuery}&error=${error}` : `?error=${error}`}`;
  try {
    const code = request.nextUrl.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(`${getAppUrl()}/login${refQuery ? `${refQuery}&error=oauth_failed` : "?error=oauth_failed"}`, { status: 307 });
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = getAppUrl();

    if (!googleClientId || !googleClientSecret) {
      return NextResponse.redirect(withRef("/login", "oauth_unconfigured"), { status: 307 });
    }

    const redirectUri = `${appUrl}/api/auth/google/callback`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(withRef("/login", "oauth_failed"), { status: 307 });
    }

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfo.id || !userInfo.email) {
      return NextResponse.redirect(withRef("/login", "oauth_failed"), { status: 307 });
    }

    const googleId = userInfo.id;
    // Normalize exactly like every other auth path (trim + lowercase) so a
    // Google account and an email+password account for the same address link
    // instead of colliding or forking.
    const email = typeof userInfo.email === "string" ? userInfo.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.redirect(withRef("/login", "oauth_failed"), { status: 307 });
    }
    const firstName = userInfo.given_name || "";
    const lastName = userInfo.family_name || "";
    const state = request.nextUrl.searchParams.get("state");
    // Referral code travels in `state` as `ref:<code>` (set by the
    // login/register pages when the URL carries ?ref=). Exact "link" keeps
    // the account-linking flow; anything else is treated as a referral.
    const referralCode = state && state !== "link" && state.startsWith("ref:")
      ? state.slice("ref:".length)
      : null;

    // Handle "link" flow: if state=link and user already authenticated, link Google to existing account
    if (state === "link") {
      const { verifyAccessToken } = await import("@/app/lib/utils/auth");
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const token = cookieStore.get("access_token")?.value;
      if (token) {
        try {
          const payload = verifyAccessToken(token);
          const existingUser = await prisma.user.findUnique({ where: { id: payload.userId } });
          if (existingUser) {
            // Check if googleId already taken by another user
            const taken = await prisma.user.findUnique({ where: { googleId } });
            if (taken && taken.id !== existingUser.id) {
              return NextResponse.redirect(`${appUrl}/profile?error=google_already_linked`, { status: 307 });
            }
            await prisma.user.update({ where: { id: existingUser.id }, data: { googleId } });
            return NextResponse.redirect(`${appUrl}/profile?success=google_linked`, { status: 307 });
          }
        } catch {
          // fall through to normal flow
        }
      }
    }

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (user) {
      const accessToken = signAccessToken({ userId: user.id, role: user.role });
      const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

      await setAuthCookies(accessToken, refreshToken);

      return NextResponse.redirect(`${appUrl}/home`, { status: 307 });
    }

    user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });

    if (user) {
      // Prevent overwriting an already linked googleId
      if (user.googleId && user.googleId !== googleId) {
        return NextResponse.redirect(`${appUrl}/login?error=account_exists`, { status: 307 });
      }
      // Auth-type-agnostic referrals: an email user signing in with Google
      // for the first time still honours a pending invite (link-only when
      // they have no inviter yet — never overwrites an existing link).
      let referralUpdate: { invitedById?: string } = {};
      let referralInviteeCount = 0;
      if (referralCode && !user.invitedById) {
        const { resolveReferral } = await import("@/app/lib/services/referralService");
        const referral = await resolveReferral(referralCode);
        if (referral.invitedById && referral.invitedById !== user.id) {
          referralUpdate = { invitedById: referral.invitedById };
          referralInviteeCount = referral.inviterInviteeCount ?? 0;
        }
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, ...referralUpdate },
      });
      if (referralUpdate.invitedById) {
        const { linkReferralRewards } = await import("@/app/lib/services/referralService");
        linkReferralRewards(referralUpdate.invitedById, user.id, referralInviteeCount);
        const { notifyReferralConversion } = await import("@/app/lib/services/notificationService");
        void notifyReferralConversion(referralUpdate.invitedById, user.id, user.userName);
      }

      const accessToken = signAccessToken({ userId: user.id, role: user.role });
      const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

      await setAuthCookies(accessToken, refreshToken);

      return NextResponse.redirect(`${appUrl}/home`, { status: 307 });
    }

    // Derive a username that always satisfies the app's username rules
    // (letters/numbers/underscore, min 3 chars) — raw email prefixes may
    // contain dots, hyphens, or other characters the register form rejects.
    const rawBase = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) || "traveller";
    const baseUserName = rawBase.length >= 3 ? rawBase : `${rawBase}go`.slice(0, 30);
    let userName = baseUserName;
    let suffix = 1;

    while (await prisma.user.findUnique({ where: { userName } })) {
      userName = `${baseUserName}_${suffix}`;
      suffix++;
    }

    // New Google signup honours referrals exactly like email register:
    // linking is unlimited; the send-credit cap lives in linkReferralRewards.
    let invitedById: string | undefined;
    let inviterInviteeCount = 0;
    if (referralCode) {
      const { resolveReferral } = await import("@/app/lib/services/referralService");
      const referral = await resolveReferral(referralCode);
      invitedById = referral.invitedById;
      inviterInviteeCount = referral.inviterInviteeCount ?? 0;
    }

    user = await prisma.user.create({
      data: {
        userName,
        firstName,
        lastName,
        email,
        password: "",
        googleId,
        verified: true,
        inviteCode: crypto.randomUUID(),
        invitedById,
      },
    });

    // Welcome + referral rewards mirror the email+password signup path.
    // Wired-in welcome email fires for Google signups too (toggle-respecting,
    // fire-and-forget so OAuth latency is unaffected).
    try {
      const { createNotification } = await import("@/app/lib/services/notificationService");
      void createNotification({
        type: "WELCOME",
        actorId: user.id,
        message: `Welcome to Along, ${firstName || "traveller"}! Share your first route to get started.`,
        recipientIds: [user.id],
        allowSelf: true,
      });
    } catch { /* non-critical */ }
    try {
      const { sendWelcomeEmail } = await import("@/app/lib/services/emailService");
      void sendWelcomeEmail(email, firstName || "traveller").then((r) => {
        if (!r.sent) console.warn(`[GOOGLE] welcome email not sent for ${email}: ${r.reason}`);
      });
    } catch { /* non-critical */ }
    if (invitedById) {
      const { linkReferralRewards } = await import("@/app/lib/services/referralService");
      linkReferralRewards(invitedById, user.id, inviterInviteeCount);
      const { notifyReferralConversion } = await import("@/app/lib/services/notificationService");
      void notifyReferralConversion(invitedById, user.id, userName);
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.redirect(`${appUrl}/home`, { status: 307 });
  } catch (error) {
    console.error("Google callback error:", error);
    Sentry.captureException(error);
    const code = (error as { code?: unknown })?.code;
    const name = (error as { name?: unknown })?.name;
    // Browser-visible: always land on a real page, never a raw /api JSON
    // body. DB-overload cases surface a retryable flag the login page
    // already renders; everything else is a generic failure.
    if (name === "PrismaClientKnownRequestError" || name === "PrismaClientInitializationError" || code === "P2022" || code === "P1001" || code === "P1002") {
      try {
        return NextResponse.redirect(withRef("/login", "server_busy"), { status: 307 });
      } catch {
        return NextResponse.json({ error: "We're experiencing high demand. Please try again in a moment." }, { status: 503 });
      }
    }
    try {
      return NextResponse.redirect(withRef("/login", "oauth_failed"), { status: 307 });
    } catch {
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  }
}
