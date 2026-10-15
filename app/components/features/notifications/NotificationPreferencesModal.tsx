"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RotateCcw } from "lucide-react"
import { AppModal } from "@/app/components/ui"
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCES_META,
  type NotificationPreferenceKey,
  type NotificationPreferenceMap,
} from "@/app/lib/config/notificationPreferences"

interface NotificationPreferencesModalProps {
  open: boolean
  onClose: () => void
}

interface PrefsResponse {
  preferences: NotificationPreferenceMap
  customized: boolean
}

/**
 * Per-user notification preferences (gear icon on the Notifications page).
 * Rows are metadata-driven; missing/NULL prefs resolve per-key to `true`
 * (current platform behaviour) so existing users see "everything on".
 * Save is a single PUT upsert; Reset restores all-on without deleting history.
 */
export function NotificationPreferencesModal({ open, onClose }: NotificationPreferencesModalProps) {
  const [prefs, setPrefs] = useState<NotificationPreferenceMap>({ ...DEFAULT_NOTIFICATION_PREFERENCES })
  const [initial, setInitial] = useState<NotificationPreferenceMap | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Stable close (AppModal keys Escape off onClose — inline closures churn
  // the listener; same pattern as the route composers).
  const handleClose = useCallback(() => {
    setError(null)
    setSaved(false)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setSaved(false)
    fetch("/api/notifications/preferences", { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`load ${res.status}`)
        const payload = (await res.json()) as PrefsResponse
        const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(payload.preferences ?? {}) }
        setPrefs(merged)
        setInitial(merged)
      })
      .catch(() => {
        // Offline/failure: show honest defaults so the modal still opens.
        setPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES })
        setInitial({ ...DEFAULT_NOTIFICATION_PREFERENCES })
        setError("Couldn't load your saved preferences — showing defaults. Changes may not save while offline.")
      })
      .finally(() => setLoading(false))
  }, [open ])

  const dirty =
    initial !== null &&
    (Object.keys(prefs) as NotificationPreferenceKey[]).some((k) => prefs[k] !== initial[k])

  const toggle = (key: NotificationPreferenceKey) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      })
      const payload = (await res.json().catch(() => null)) as (PrefsResponse & { error?: string }) | null
      if (!res.ok) throw new Error(payload?.error ?? `save ${res.status}`)
      if (payload?.preferences) {
        const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...payload.preferences }
        setPrefs(merged)
        setInitial(merged)
      } else {
        setInitial({ ...prefs })
      }
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save preferences. Try again when back online.")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES })
    setSaved(false)
    setError(null)
  }

  return (
    <AppModal
      open={open}
      onClose={handleClose}
      size="default"
      title={NOTIFICATION_PREFERENCES_META.title}
      subtitle={NOTIFICATION_PREFERENCES_META.description}
      footer={
        <>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading || saving}
            className="inline-flex items-center gap-1.5 h-10 px-4 radius-md border border-border bg-bg-card text-sm font-medium text-text-secondary cursor-pointer font-sans hover:bg-bg-elevated transition-colors duration-fast disabled:opacity-60"
          >
            <RotateCcw size={14} aria-hidden />
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saving || !dirty}
            aria-busy={saving}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 radius-md bg-primary text-white border-none text-sm font-semibold cursor-pointer font-sans hover:bg-primary-light transition-colors duration-fast disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-2 py-4" aria-label="Loading preferences">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 bg-bg-elevated radius-md animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {error && (
            <p role="alert" className="text-xs text-error-text bg-error-muted border border-error-border radius-md px-3 py-2">
              {error}
            </p>
          )}
          {saved && !error && (
            <p role="status" className="text-xs text-text-primary bg-primary-muted border border-border radius-md px-3 py-2">
              Preferences saved. Changes apply to future notifications immediately.
            </p>
          )}
          {NOTIFICATION_PREFERENCES_META.sections.map((section) => (
            <fieldset key={section.id} className="border-none p-0 m-0">
              <legend className="text-[11px] font-semibold tracking-wider uppercase text-text-muted mb-2 px-0">
                {section.label}
              </legend>
              <div className="flex flex-col radius-md border border-border overflow-hidden">
                {section.keys.map((key, idx) => {
                  const on = prefs[key] === true
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between gap-3 px-4 py-3 bg-bg-base ${idx > 0 ? "border-t border-border" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary">
                          {NOTIFICATION_PREFERENCES_META.keyLabels[key]}
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">
                          {NOTIFICATION_PREFERENCES_META.keyHints[key]}
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={NOTIFICATION_PREFERENCES_META.keyLabels[key]}
                        onClick={() => toggle(key)}
                        className={`relative w-11 h-6 rounded-full border-none cursor-pointer shrink-0 transition-colors duration-fast ${on ? "bg-primary" : "bg-bg-elevated"}`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-fast ${on ? "left-[22px]" : "left-0.5"}`}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </AppModal>
  )
}
