"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect, useState } from "react"
import { ERROR_REPORTING_CONFIG } from "@/app/lib/config/errorReporting"
import { reportClientError } from "@/app/lib/services/errorReportService"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // `null` = still attempting; boolean once the report attempt settles.
  const [reported, setReported] = useState<boolean | null>(null)

  useEffect(() => {
    Sentry.captureException(error)
    let cancelled = false
    void reportClientError(error, { digest: error.digest }).then(({ reported }) => {
      if (!cancelled) setReported(reported)
    })
    return () => { cancelled = true }
  }, [error])

  const statusCopy =
    reported === null
      ? ERROR_REPORTING_CONFIG.copy.pending
      : reported
        ? ERROR_REPORTING_CONFIG.copy.reported
        : ERROR_REPORTING_CONFIG.copy.unreported

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-bg-base text-center">
          <div className="max-w-[420px]">
            <h1 className="text-2xl font-bold text-text-primary mb-3">Something went wrong</h1>
            <p className="text-sm text-text-secondary mb-2">
              An unexpected error occurred. Please try again.
            </p>
            <p className="text-xs text-text-muted mb-6" role="status">
              {statusCopy}
            </p>
            <button
              onClick={reset}
              className="inline-flex items-center h-10 px-5 rounded-md bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer border-none"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
