"use client"

import React, { useState, Suspense } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react"
import { AppButton, AppCard, AppAlert, AppSpinner } from "@/app/components/ui"

function ResetPasswordForm() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const email = searchParams.get("email") || ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      })
      if (res.ok) {
        setSuccess(true)
      } else {
        let msg = "Reset failed"
        try {
          const text = await res.text()
          const data = text ? JSON.parse(text) as { error?: string } : null
          if (data?.error) msg = data.error
        } catch {
          msg = res.status === 504 ? "Server is busy. Please try again." : "Reset failed"
        }
        throw new Error(msg)
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Something went wrong"
      if (m.includes("Unexpected token") || m.includes("is not valid JSON")) setError("Server is busy. Please try again in a moment.")
      else setError(m)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-base">
      <AppCard variant="elevated" className="p-8 w-full max-w-[400px]">
        {success ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-circle bg-success flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} className="text-success-text" />
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">Password reset</h1>
            <p className="text-sm text-text-secondary mb-6">Your password has been reset successfully.</p>
            <Link href="/login" className="inline-flex items-center justify-center px-4 py-2 radius-md bg-primary text-white text-sm font-semibold no-underline hover:bg-primary-light transition-colors">
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-text-primary mb-2">Reset your password</h1>
            <p className="text-sm text-text-secondary mb-6">Enter your new password below.</p>

            {error && <AppAlert variant="error" className="mb-4" dismissible onDismiss={() => setError("")}>{error}</AppAlert>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="text-sm font-medium text-text-primary block mb-1.5">New Password</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none shrink-0"><Lock size={16} /></span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="h-[40px] w-full border-[1.5px] rounded-sm bg-bg-base px-[12px] text-sm text-text-primary pl-10 pr-10 placeholder:text-text-muted transition-all duration-fast focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] border-border"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary border-none bg-transparent cursor-pointer p-0" aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="text-sm font-medium text-text-primary block mb-1.5">Confirm Password</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none shrink-0"><AlertCircle size={16} /></span>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className="h-[40px] w-full border-[1.5px] rounded-sm bg-bg-base px-[12px] text-sm text-text-primary pl-10 pr-10 placeholder:text-text-muted transition-all duration-fast focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] border-border"
                  />
                </div>
              </div>

              <AppButton type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                Reset Password
              </AppButton>
            </form>

            <p className="text-center text-sm text-text-secondary mt-6">
              <Link href="/login" className="text-primary font-medium hover:underline">Back to sign in</Link>
            </p>
          </>
        )}
      </AppCard>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><AppSpinner /></div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
