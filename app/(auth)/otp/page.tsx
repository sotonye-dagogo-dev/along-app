"use client"

import React, { useState, useRef, useEffect, Suspense } from "react"
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

function OtpForm() {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""))
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [loading, setLoading] = useState(false)
  const [sendFailed, setSendFailed] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const rememberMe = searchParams.get("rememberMe") === "true"
  // Register starts the server cooldown at issuance; seed the timer from the
  // URL when the register response provided one (?cooldown=), else the
  // config default so first-tap resends never 429 by surprise.
  const seedCooldown = Number(searchParams.get("cooldown") ?? "") || AUTH_VERIFICATION_CONFIG.resendCooldownSeconds
  const { cooldown, busy: resending, requestCode } = useOtpResend(seedCooldown)
  const canResend = cooldown <= 0

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const digit = value.slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
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
    const pastedData = e.clipboardData.getData("text/plain").replace(/\D/g, "").slice(0, OTP_LENGTH)
    if (!pastedData) return
    const newOtp = Array(OTP_LENGTH).fill("")
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i]
    }
    setOtp(newOtp)
    const focusIndex = Math.min(pastedData.length, OTP_LENGTH - 1)
    inputRefs.current[focusIndex]?.focus()
  }

  const handleResend = async () => {
    if (!canResend || resending) return
    setError("")
    setInfo("")
    const result = await requestCode("/api/auth/otp/resend", { email })
    if (result.ok) {
      setSendFailed(!result.sent)
      if (result.sent) {
        setInfo(`New code sent to ${maskEmail(email)}. ${AUTH_VERIFICATION_CONFIG.copy.previousInvalidated}`)
        toastService.success("New code sent — use the newest email.")
      } else {
        // Code IS valid server-side; only delivery failed — say so plainly.
        setError(result.error ?? AUTH_VERIFICATION_CONFIG.copy.sendFailed)
      }
    } else {
      // 429 carries retryAfter and the hook already adopted the timer.
      setError(result.error ?? "Couldn't resend. Please try again.")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join("")
    if (code.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit code")
      return
    }
    setError("")
    setInfo("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code, rememberMe }),
      })
      if (!res.ok) {
        let msg = "Invalid verification code"
        try {
          const text = await res.text()
          const data = text ? JSON.parse(text) as { error?: string } : null
          if (data?.error) msg = data.error
          else if (res.status === 504 || res.status === 503) msg = "Server is busy. Your code stays valid — please try again in a moment."
          else if (res.status === 429) msg = AUTH_VERIFICATION_CONFIG.copy.rateLimited(Number(res.headers.get("Retry-After") ?? "60"))
        } catch {
          msg = res.status === 504 || res.status === 503 ? "Server is busy. Your code stays valid — please try again in a moment." : "Verification failed. Please try again."
        }
        throw new Error(msg)
      }
      toastService.success("Email verified — welcome!")
      window.location.href = "/"
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

  return (
    <AppCard variant="elevated" className="p-10">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Verify your email</h1>
        <p className="text-sm text-text-secondary">
          {email ? (
            <>Enter the 6-digit code sent to <span className="font-semibold">{maskEmail(email)}</span></>
          ) : (
            <>Enter the 6-digit code sent to your email</>
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
      {sendFailed && !error && (
        <AppAlert variant="warning" className="mb-6" dismissible onDismiss={() => setSendFailed(false)}>
          {AUTH_VERIFICATION_CONFIG.copy.sendFailed}
        </AppAlert>
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
        {!canResend ? (
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
    </AppCard>
  )
}

export default function OtpPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><AppSpinner /></div>}>
      <OtpForm />
    </Suspense>
  )
}
