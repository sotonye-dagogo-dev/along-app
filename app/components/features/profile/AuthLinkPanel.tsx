"use client"

import { useEffect, useState } from "react"
import { AppButton, AppAlert } from "@/app/components/ui"
import { toastService } from "@/app/lib/services/toastService"
import { Link2, Shield, Eye, EyeOff } from "lucide-react"

export function AuthLinkPanel() {
  const [status, setStatus] = useState<{ hasGoogle: boolean; hasPassword: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/auth/link/status")
        if (res.ok) {
          const data = await res.json()
          setStatus(data)
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const handleAddPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/auth/link/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      let msg = "Password linked"
      try {
        const t = await res.text()
        const d = t ? (JSON.parse(t) as { error?: string; message?: string }) : null
        if (d?.error) msg = d.error
        else if (d?.message) msg = d.message
      } catch {}
      if (!res.ok) throw new Error(msg)
      toastService.success(msg)
      setPassword("")
      setStatus((s) => (s ? { ...s, hasPassword: true } : s))
    } catch (err) {
      const m = err instanceof Error ? err.message : "Failed to link password"
      if (m.includes("Unexpected token")) setError("Server is busy. Please try again.")
      else setError(m)
    } finally {
      setSaving(false)
    }
  }

  const handleLinkGoogle = () => {
    window.location.href = "/api/auth/google?state=link"
  }

  if (loading) {
    return <div className="h-20 bg-bg-elevated animate-pulse rounded-lg" />
  }
  if (!status) return null

  return (
    <div className="bg-bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={18} className="text-primary" />
        <h3 className="text-sm font-semibold text-text-primary">Connected Accounts</h3>
      </div>
      {error && <AppAlert variant="error" className="mb-3" dismissible onDismiss={() => setError(null)}>{error}</AppAlert>}

      <div className="flex flex-col gap-3">
        {/* Google */}
        <div className="flex items-center justify-between p-3 rounded-md bg-bg-elevated border border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
            </div>
            <div>
              <div className="text-sm font-medium text-text-primary">Google</div>
              <div className="text-xs text-text-muted">{status.hasGoogle ? "Connected" : "Not connected"}</div>
            </div>
          </div>
          {!status.hasGoogle ? (
            <AppButton variant="secondary" size="sm" onClick={handleLinkGoogle}>Connect</AppButton>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success text-white text-xs font-medium"><Shield size={12} />Linked</span>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-2 p-3 rounded-md bg-bg-elevated border border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-text-primary">Password</div>
              <div className="text-xs text-text-muted">{status.hasPassword ? "You can sign in with email & password" : "Add a password to enable email sign-in"}</div>
            </div>
            {status.hasPassword && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success text-white text-xs font-medium"><Shield size={12} />Enabled</span>}
          </div>
          {!status.hasPassword && (
            <form onSubmit={handleAddPassword} className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="h-9 w-full border border-border rounded-md bg-bg-card px-3 pr-9 text-sm focus:outline-none focus:border-primary"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary bg-transparent border-none cursor-pointer p-1">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <AppButton type="submit" variant="primary" size="sm" loading={saving}>Add</AppButton>
            </form>
          )}
        </div>
      </div>

      {!status.hasGoogle && !status.hasPassword && (
        <p className="text-xs text-text-muted mt-2">Tip: Link both methods so you can sign in either way.</p>
      )}
    </div>
  )
}
