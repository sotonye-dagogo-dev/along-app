"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { sanitizeInviteCode } from "@/app/lib/config/inviteConfig";

/**
 * Legacy / friendly invite-code entry point.
 *
 * Accepts /invite/<code> (hand-typed, older shares, or a miscopied URL) and
 * forwards to the canonical /register?ref=<code> page route — so invitees
 * never land on, share, or refresh an /api route. Non-breaking additive
 * route; the canonical /register?ref= flow is unchanged.
 */
export default function InviteCodeRedirectPage() {
  const params = useParams<{ code?: string | string[] }>();
  const router = useRouter();
  const raw = Array.isArray(params?.code) ? params.code[0] : params?.code;
  const code = sanitizeInviteCode(typeof raw === "string" ? decodeURIComponent(raw) : null);

  React.useEffect(() => {
    if (code) router.replace(`/register?ref=${encodeURIComponent(code)}`);
  }, [code, router]);

  if (!code) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold mb-2">That invite link looks incomplete</h1>
        <p className="text-sm text-text-secondary mb-6">
          Ask your friend for a fresh invite link, or continue to sign up directly.
        </p>
        <Link href="/register" className="text-sm text-primary underline underline-offset-2">
          Go to sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto px-4 py-16 text-center">
      <p className="text-sm text-text-secondary">Taking you to sign up…</p>
      <Link
        href={`/register?ref=${encodeURIComponent(code)}`}
        className="block mt-4 text-sm text-primary underline underline-offset-2"
      >
        Continue to sign up
      </Link>
    </div>
  );
}
