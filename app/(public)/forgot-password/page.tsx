"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Mail, ArrowLeft } from "lucide-react"
import { AppButton, AppInput, AppCard, AppAlert } from "@/app/components/ui"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email.trim()) {
      setError("Email is required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSent(true)
      } else {
        let msg = "Something went wrong"
        try {
          const text = await res.text()
          const data = text ? JSON.parse(text) as { error?: string } : null
          if (data?.error) msg = data.error
        } catch {
          msg = res.status === 504 ? "Server is busy. Please try again." : "Something went wrong"
        }
        throw new Error(msg)
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Something went wrong"
      if (m.includes("Unexpected token") || m.includes("is not valid JSON")) {
        setError("Server is busy. Please try again in a moment.")
      } else setError(m)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-base">
      <AppCard variant="elevated" className="p-8 w-full max-w-[400px]">
        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-circle bg-success flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-success-text" />
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">Check your email</h1>
            <p className="text-sm text-text-secondary mb-6">
              If an account exists for {email}, we&apos;ve sent password reset instructions.
            </p>
            <Link href="/login" className="text-sm text-primary font-medium hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-6">
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
            <h1 className="text-xl font-bold text-text-primary mb-2">Forgot password?</h1>
            <p className="text-sm text-text-secondary mb-6">
              Enter your email and we&apos;ll send you reset instructions.
            </p>
            {error && <AppAlert variant="error" className="mb-4" dismissible onDismiss={() => setError("")}>{error}</AppAlert>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <AppInput
                label="Email"
                type="email"
                placeholder="you@example.com"
                icon={<Mail size={16} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <AppButton type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                Send Reset Link
              </AppButton>
            </form>
          </>
        )}
      </AppCard>
    </div>
  )
}
