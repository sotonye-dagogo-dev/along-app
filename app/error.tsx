"use client"

import { useEffect } from "react"

export default function ErrorPage({ error, reset }: { error?: (Error & { digest?: string }) | null; reset?: () => void }) {
  useEffect(() => {
    console.error("Page error:", error)
  }, [error])

  // Guard against non-Error throws (strings, null, undefined)
  const isDev = process.env.NODE_ENV !== "production"
  const detail =
    error && typeof error.message === "string" && error.message.trim().length > 0
      ? error.message
      : "An unexpected error occurred. Please try again."

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-bg-base text-center">
      <div className="max-w-[420px]">
        <h1 className="text-2xl font-bold text-text-primary mb-3">Something went wrong</h1>
        <p className="text-sm text-text-secondary mb-6">
          {isDev ? detail : "An unexpected error occurred. Please try again."}
        </p>
        {isDev && detail !== "An unexpected error occurred. Please try again." && (
          <p className="text-[11px] font-mono text-text-muted mb-4 break-all">
            {error?.name}
            {error?.digest ? ` (digest: ${error.digest})` : ""}
          </p>
        )}
        <button
          onClick={() => reset?.()}
          className="inline-flex items-center h-10 px-5 rounded-md bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer border-none"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
