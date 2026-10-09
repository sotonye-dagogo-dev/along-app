"use client"

import React, { useState, useRef, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AppButton, AppCard, AppAlert, AppSpinner } from "@/app/components/ui"
import { toastService } from "@/app/lib/services/toastService"
import { useOtpResend, formatCooldown } from "@/app/lib/hooks/useOtpResend"
import {
  AUTH_VERIFICATION_CONFIG,
  OTP_TTL_MINUTES,
  maskEmail,
} from "@/app/lib/config/authVerification"

const OTP_LENGTH = 6

/**
 * /verify-email — landing target for every verification email link
 * (`/verify-email?email=…`). Previously this route did not exist, so the
 * "Verify email" button in verification mails led to a "Page not found".
 * Accepts ?email (prefill) and ?otp/?code/?token (prefill the boxes when
 * 6 digits); verifies via PUT /api/auth/verify-email (no login required,
 * so the link works on any device), resends via POST with the shared
 * server-driven cooldown timer.
 */
function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const emailParam = (searchParams.get("email") || "").trim()
  const codeParam = (
    searchParams.get("otp") ||
    searchParams.get("code") ||
    searchParams.get("token") ||
    ""
  ).replace(/\D/g, "").slice(0, OTP_LENGTH)

  const [email, setEmail] = useState(emailParam)
  const [otp, setOtp] = useState<string[]>(() => {
    const boxes = Array<string>(OTP_LENGTH).fill("")
    for (let i = 0; i < codeParam.length; i++) boxes[i] = codeParam[i]
    return boxes
  })
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [alreadyVerified, setAlreadyVerified] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  // No assumed cooldown on entry (the link itself is not a send): the server
  // enforces the real per-email cooldown and the hook adopts its timer.
  const { cooldown, busy: resending, requestCode } = useOtpResend(0)
  const canResend = cooldown <= 0

  useEffect(() => {
    setEmail(emailParam)
  }, [emailParam])

  useEffect(() => {
    if (email) inputRefs.current[0]?.focus()
  }, [email])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const digit = value.slice(-1)
    const next = [...otp]
    next[index] = digit
    setOtp(next)
    setError("")
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text/plain").replace(/\D/g, "").slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill("")
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setOtp(next)
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }

  const handleResend = async () => {
    if (!canResend || resending || !email) return
    setError("")
    setInfo("")
    setAlreadyVerified(false)
    const result = await requestCode("/api/auth/verify-email", { email })
    if (result.ok) {
      if (result.sent) {
        setInfo(`New code sent to ${maskEmail(email)}. ${AUTH_VERIFICATION_CONFIG.copy.previousInvalidated}`)
        toastService.success("New code sent — use the newest email.")
      } else {
        setError(result.error ?? AUTH_VERIFICATION_CONFIG.copy.sendFailed)
      }
    } else {
      try {
        const marker = (result.error ?? "").toLowerCase()
        if (marker.includes("already verified")) {
          setAlreadyVerified(true)
          return
        }
      } catch { /* fall through */ }
      setError(result.error ?? "Couldn't resend. Please try again.")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join("")
    if (!email.trim()) {
      setError("Enter your email address first.")
      return
    }
    if (code.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit code")
      return
    }
    setError("")
    setInfo("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: code }),
      })
      let data: { error?: string; message?: string; alreadyVerified?: boolean } = {}
      try {
        const text = await res.text()
        data = text ? (JSON.parse(text) as typeof data) : {}
      } catch {
        throw new Error("Server is busy. Your code stays valid — please try again in a moment.")
      }
      if (!res.ok) {
        if (res.status === 504 || res.status === 503) {
          throw new Error("Server is busy. Your code stays valid — please try again in a moment.")
        }
        if (res.status === 429) {
          throw new Error(
            data.error ?? AUTH_VERIFICATION_CONFIG.copy.rateLimited(Number(res.headers.get("Retry-After") ?? "60"))
          )
        }
        throw new Error(data.error ?? "Verification failed. Please try again.")
      }
      setVerified(true)
      toastService.success("Email verified — you can now sign in!")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      if (msg.includes("Unexpected token") || msg.includes("is not valid JSON")) {
        setError("Server is busy. Your code stays valid — please try again in a moment.")
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  if (verified || alreadyVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-bg-base">
        <AppCard variant="elevated" className="p-10 w-full max-w-[440px] text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            {alreadyVerified ? "Already verified" : "Email verified"}
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            {alreadyVerified
              ? "This address is already verified — just sign in."
              : "Your email is confirmed. Welcome aboard!"}
          </p>
          <Link href="/login" className="inline-flex items-center justify-center px-4 py-2 radius-md bg-primary text-white text-sm font-semibold no-underline hover:bg-primary-light transition-colors">
            Continue to sign in
          </Link>
        </AppCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-base">
      <AppCard variant="elevated" className="p-10 w-full max-w-[440px]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Verify your email</h1>
          <p className="text-sm text-text-secondary">
            {email ? (
              <>Enter the 6-digit code sent to <span className="font-semibold">{maskEmail(email)}</span></>
            ) : (
              <>Enter your email to get a code, then enter it below</>
            )}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {AUTH_VERIFICATION_CONFIG.copy.codeExpiryNote(OTP_TTL_MINUTES)}{" "}
            {AUTH_VERIFICATION_CONFIG.copy.previousInvalidated}
          </p>
        </div>

        {error && (
          <AppAlert variant="error" className="mb-6" dismissible onDismiss={() => setError("")}>
            {error}
          </AppAlert>
        )}
        {info && !error && (
          <AppAlert variant="info" className="mb-6" dismissible onDismiss={() => setInfo("")}>
            {info}
          </AppAlert>
        )}

        {!emailParam && (
          <div className="mb-6">
            <label htmlFor="verify-email-address" className="text-sm font-medium text-text-primary block mb-1.5">
              Email address
            </label>
            <input
              id="verify-email-address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-[40px] w-full border-[1.5px] rounded-sm bg-bg-base px-[12px] text-sm text-text-primary placeholder:text-text-muted transition-all duration-fast focus:outline-none focus:border-primary border-border"
            />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-[44px] h-[52px] text-center text-2xl font-bold border border-border rounded-sm bg-bg-base text-text-primary focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] transition-all duration-fast"
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          <AppButton type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            Verify Email
          </AppButton>
        </form>

        <div className="text-center mt-6">
          {!email ? (
            <p className="text-sm text-text-muted">Enter your email above to request a code.</p>
          ) : !canResend ? (
            <p className="text-sm text-text-secondary" role="status" aria-live="polite">
              Resend code in{" "}
              <span className="text-primary font-semibold">{formatCooldown(cooldown)}</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="text-sm text-primary font-medium hover:text-primary-dark transition-colors duration-fast cursor-pointer disabled:opacity-50"
            >
              {resending ? "Sending…" : "Didn't receive it? Resend"}
            </button>
          )}
        </div>

        <p className="text-center text-sm text-text-secondary mt-6">
          <Link href="/login" className="text-primary font-medium hover:underline">Back to sign in</Link>
        </p>
      </AppCard>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><AppSpinner /></div>}>
      <VerifyEmailForm />
    </Suspense>
  )
}
