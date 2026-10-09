"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUTH_VERIFICATION_CONFIG } from "@/app/lib/config/authVerification";

export interface OtpSendResult {
  ok: boolean;
  /** True when the mail provider accepted the message. */
  sent: boolean;
  error?: string;
  retryAfter?: number;
  cooldown?: number;
  expiresIn?: number;
  expired?: boolean;
  attemptsLeft?: number;
  invalidatesPrevious?: boolean;
}

/**
 * Shared OTP resend/verify-feedback hook (register OTP screen, profile
 * EmailSecurityPanel). Owns the cooldown countdown from SERVER values
 * (retryAfter/cooldown) so the timer and the throttle can never disagree,
 * and normalises every send/verify payload into one result shape.
 */
export function useOtpResend(initialCooldown = 0) {
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [cooldown]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const parseBody = useCallback(async (res: Response): Promise<OtpSendResult> => {
    const retryHeader = res.headers.get("Retry-After");
    const headerRetry = retryHeader ? Number(retryHeader) : NaN;
    let data: Record<string, unknown> = {};
    try {
      const text = await res.text();
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch { /* non-JSON (504 gateway etc.) */ }
    const retryAfter =
      typeof data.retryAfter === "number"
        ? data.retryAfter
        : Number.isFinite(headerRetry)
          ? headerRetry
          : undefined;
    if (!res.ok) {
      const statusNote =
        res.status === 429
          ? AUTH_VERIFICATION_CONFIG.copy.rateLimited(retryAfter ?? AUTH_VERIFICATION_CONFIG.resendCooldownSeconds)
          : res.status === 504 || res.status === 503
            ? "Server is busy. Your newest code stays valid — please try again in a moment."
            : null;
      return {
        ok: false,
        sent: false,
        error:
          (typeof data.error === "string" && data.error) ||
          statusNote ||
          `Request failed (${res.status}). Please try again.`,
        retryAfter,
        expired: data.expired === true,
        attemptsLeft: typeof data.attemptsLeft === "number" ? data.attemptsLeft : undefined,
      };
    }
    const cooldownSecs =
      typeof data.cooldown === "number"
        ? data.cooldown
        : typeof retryAfter === "number"
          ? retryAfter
          : AUTH_VERIFICATION_CONFIG.resendCooldownSeconds;
    return {
      ok: true,
      sent: data.sent !== false,
      error:
        data.sent === false
          ? (typeof data.message === "string" && data.message) ||
            AUTH_VERIFICATION_CONFIG.copy.sendFailed
          : undefined,
      retryAfter,
      cooldown: cooldownSecs,
      expiresIn:
        typeof data.expiresIn === "number" ? data.expiresIn : AUTH_VERIFICATION_CONFIG.otpTtlSeconds,
      invalidatesPrevious: data.invalidatesPrevious === true,
    };
  }, []);

  /** POST a resend/trigger and adopt the server cooldown. Never throws. */
  const requestCode = useCallback(
    async (url: string, body: unknown): Promise<OtpSendResult> => {
      if (busy) return { ok: false, sent: false, error: "Please wait…" };
      setBusy(true);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await parseBody(res);
        // Adopt the authoritative timer: explicit retryAfter wins, else the
        // endpoint cooldown. On failure WITHOUT a timer, keep the old one.
        const next =
          typeof result.retryAfter === "number"
            ? result.retryAfter
            : result.ok && typeof result.cooldown === "number"
              ? result.cooldown
              : 0;
        if (next > 0) setCooldown(next);
        return result;
      } catch {
        return { ok: false, sent: false, error: "You're offline or the server is unreachable. Your newest code stays valid — try again when back online." };
      } finally {
        setBusy(false);
      }
    },
    [busy, parseBody]
  );

  return { cooldown, setCooldown, busy, requestCode, parseBody };
}

/** mm:ss for cooldown timers. */
export function formatCooldown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
