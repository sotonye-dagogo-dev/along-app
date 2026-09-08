"use client"

import React, { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AppButton, AppCard, AppAlert, AppSpinner } from "@/app/components/ui"

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 45

function OtpForm() {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""))
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const [canResend, setCanResend] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const rememberMe = searchParams.get("rememberMe") === "true"

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true)
      return
    }
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

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

  const handleResend = () => {
    if (!canResend) return
    setCountdown(RESEND_COOLDOWN)
    setCanResend(false)
    // Resend OTP — use forgot-password style or re-trigger register OTP flow via new endpoint
    fetch("/api/auth/otp/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => {})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join("")
    if (code.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit code")
      return
    }
    setError("")
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
          else if (res.status === 504) msg = "Server is busy. Please try again."
        } catch {
          msg = res.status === 504 ? "Server is busy. Please try again." : "Verification failed. Please try again."
        }
        throw new Error(msg)
      }
      window.location.href = "/"
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      if (msg.includes("Unexpected token") || msg.includes("is not valid JSON")) {
        setError("Server is busy. Please try again in a moment.")
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  return (
    <AppCard variant="elevated" className="p-10">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Verify your email</h1>
        <p className="text-sm text-text-secondary">
          Enter the 6-digit code sent to t***@example.com
        </p>
      </div>

      {error && (
        <AppAlert variant="error" className="mb-6" dismissible onDismiss={() => setError("")}>
          {error}
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
          <p className="text-sm text-text-secondary">
            Resend code in{" "}
            <span className="text-primary font-semibold">{formatCountdown(countdown)}</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="text-sm text-primary font-medium hover:text-primary-dark transition-colors duration-fast cursor-pointer"
          >
            Didn&apos;t receive it? Resend
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
