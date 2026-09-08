"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react"
import { AppButton, AppInput, AppCard, AppDivider, AppAlert } from "@/app/components/ui"
import { toastService } from "@/app/lib/services/toastService"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const validate = () => {
    const errors: { email?: string; password?: string } = {}
    if (!email.trim()) errors.email = "Email is required"
    if (!password) errors.password = "Password is required"
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      })
      if (!res.ok) {
        let msg = "Invalid email or password"
        try {
          const text = await res.text()
          const data = text ? JSON.parse(text) as { error?: string } : null
          if (data?.error) msg = data.error
          else if (res.status === 504 || res.status === 503) msg = "Server is busy. Please try again in a moment."
          else if (res.status === 429) msg = "Too many attempts. Please wait and try again."
        } catch {
          if (res.status === 504 || res.status === 503) msg = "Server is busy. Please try again in a moment."
          else msg = `Request failed (${res.status}). Please try again.`
        }
        throw new Error(msg)
      }
      toastService.success("Signed in successfully")
      setTimeout(() => { window.location.href = "/home" }, 300)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      // Sanitize raw JSON parse errors like "Unexpected token 'A'..."
      if (msg.includes("Unexpected token") || msg.includes("is not valid JSON")) {
        setError("Server is busy. Please try again in a moment.")
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
        <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome back</h1>
        <p className="text-sm text-text-secondary">Sign in to continue to Along</p>
      </div>

      {error && (
        <AppAlert variant="error" className="mb-6" dismissible onDismiss={() => setError("")}>
          {error}
        </AppAlert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AppInput
          label="Email"
          type="email"
          placeholder="you@example.com"
          icon={<Mail size={16} />}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => ({ ...prev, email: undefined })) }}
          error={fieldErrors.email}
        />
        <div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-text-primary">Password</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none shrink-0"><Lock size={16} /></span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((prev) => ({ ...prev, password: undefined })) }}
                className={`h-[40px] w-full border-[1.5px] rounded-sm bg-bg-base px-[12px] text-sm text-text-primary pl-10 pr-10 placeholder:text-text-muted transition-all duration-fast focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] ${fieldErrors.password ? 'border-error-border focus:border-error-border focus:shadow-[0_0_0_3px_rgba(127,29,29,0.12)]' : 'border-border'}`}
                aria-invalid={fieldErrors.password ? "true" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary border-none bg-transparent cursor-pointer p-0"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="flex items-center gap-1 text-xs text-error-text" role="alert">
                <AlertCircle size={12} />
                {fieldErrors.password}
              </span>
            )}
          </div>
          <div className="text-right mt-1">
            <Link href="/forgot-password" className="text-xs text-primary hover:text-primary-dark transition-colors duration-fast">
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
            <span className="text-sm font-medium text-text-secondary">Remember me</span>
          </label>
        </div>

        <AppButton type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          Sign In
        </AppButton>
      </form>

      <AppDivider className="my-6">or continue with</AppDivider>

      <AppButton
        type="button"
        variant="secondary"
        fullWidth
        className="bg-bg-card border-border text-text-primary hover:bg-bg-elevated"
        onClick={() => { window.location.href = '/api/auth/google' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Sign in with Google
      </AppButton>

      <Link href="/home" className="block text-center text-sm text-text-secondary hover:text-text-primary mt-4 underline underline-offset-2">
        Continue as guest
      </Link>

      <p className="text-center text-sm text-text-secondary mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-primary font-medium hover:text-primary-dark transition-colors duration-fast">
          Create one
        </Link>
      </p>
    </AppCard>
  )
}
