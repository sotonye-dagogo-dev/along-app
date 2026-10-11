"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect, useMemo, useRef, useState } from "react"
import { ERROR_REPORTING_CONFIG } from "@/app/lib/config/errorReporting"
import { reportClientError, buildErrorReportPrefill, buildBugReportUrl } from "@/app/lib/services/errorReportService"
import { toastService } from "@/app/lib/services/toastService"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // `null` = still attempting; boolean once the report attempt settles.
  const [reported, setReported] = useState<boolean | null>(null)
  const toastFired = useRef(false)

  // Sanitized prefill (message/stack/route/digest — PII redacted, capped) so
  // the bug-report CTA carries solid context the reporter can extend with
  // their own details above or below it.
  const bugReportUrl = useMemo(
    () => buildBugReportUrl(buildErrorReportPrefill(error, { digest: error.digest })),
    [error]
  )

  useEffect(() => {
    Sentry.captureException(error)
    let cancelled = false
    void reportClientError(error, { digest: error.digest }).then(({ reported }) => {
      if (!cancelled) setReported(reported)
    })
    // Toast CTA to the prefilled bug-report page (best-effort, once per
    // error instance — never throws, never blocks the error UI).
    if (!toastFired.current) {
      toastFired.current = true
      try {
        const url = buildBugReportUrl(buildErrorReportPrefill(error, { digest: error.digest }))
        toastService.show({
          message: ERROR_REPORTING_CONFIG.toast.message,
          type: "error",
          undoLabel: ERROR_REPORTING_CONFIG.toast.actionLabel,
          onUndo: () => {
            try {
              window.location.assign(url)
            } catch {
              /* navigation unavailable — inline CTA remains */
            }
          },
        })
      } catch {
        /* toast is best-effort */
      }
    }
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
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={reset}
                className="inline-flex items-center h-10 px-5 rounded-md bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer border-none"
              >
                Try again
              </button>
              <a
                href={bugReportUrl}
                className="inline-flex items-center h-10 px-5 rounded-md border border-border text-sm font-semibold text-text-primary no-underline hover:bg-bg-elevated transition-colors"
              >
                {ERROR_REPORTING_CONFIG.reportCtaLabel}
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
