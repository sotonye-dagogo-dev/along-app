"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { Locale, TranslationMap } from "@/app/lib/config/i18n"
import { DEFAULT_LOCALE, STORAGE_KEY } from "@/app/lib/config/i18n"
// Bundled English fallback — guarantees the UI never renders raw i18n keys
// (e.g. guest.signIn) when the /locales/*.json fetch fails offline. The SW
// also precaches both dictionaries; this is the last-resort layer.
import bundledEn from "@/public/locales/en.json"

type Translations = Record<string, string>

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  /** Translation with explicit English fallback (never renders a raw key). */
  tf: (key: string, fallback: string, params?: Record<string, string | number>) => string
  isLoading: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

const LAST_GOOD_KEY = (locale: Locale) => `along-locale-cache:${locale}`
const LOCALE_COOKIE = "along-locale"

function flatten(data: TranslationMap): Translations {
  const flat: Translations = {}
  const walk = (obj: Record<string, unknown>, prefix = "") => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        flat[prefix + key] = value
      } else if (typeof value === "object" && value !== null) {
        walk(value as Record<string, unknown>, prefix + key + ".")
      }
    }
  }
  walk(data as unknown as Record<string, unknown>)
  return flat
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

function readLastGood(locale: Locale): Translations | null {
  try {
    const raw = localStorage.getItem(LAST_GOOD_KEY(locale))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Translations
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) return parsed
    return null
  } catch {
    return null
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  // Start from the bundled English map so first paint (incl. offline) never
  // shows raw keys; replaced by the active locale once loaded/cached.
  const [translations, setTranslations] = useState<Translations>(() => flatten(bundledEn as unknown as TranslationMap))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
      if (stored === "en" || stored === "pcm") {
        setLocaleState(stored)
        return
      }
      const lang = navigator.language?.toLowerCase()
      if (lang?.startsWith("pcm") || lang === "en-pcm") setLocaleState("pcm")
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // Seed instantly from the last good cache so toggling/offline swaps
    // feel seamless even before the network responds.
    const lastGood = readLastGood(locale)
    if (lastGood) setTranslations(lastGood)

    const loadTranslations = async () => {
      // English resolves synchronously from the bundle (no network needed).
      if (locale === "en") {
        const flat = flatten(bundledEn as unknown as TranslationMap)
        if (!cancelled) {
          setTranslations(flat)
          setIsLoading(false)
        }
        try {
          localStorage.setItem(LAST_GOOD_KEY("en"), JSON.stringify(flat))
        } catch { /* quota/private-mode — non-critical */ }
        return
      }
      setIsLoading(true)
      try {
        const res = await fetch(`/locales/${locale}.json`)
        if (!res.ok) throw new Error(`locale ${locale} unavailable`)
        const data: TranslationMap = await res.json()
        const flat = flatten(data)
        if (cancelled || Object.keys(flat).length === 0) return
        setTranslations(flat)
        try {
          localStorage.setItem(LAST_GOOD_KEY(locale), JSON.stringify(flat))
        } catch { /* non-critical */ }
      } catch {
        // Offline / fetch failure: keep last-good, else bundled English —
        // never an empty map (which renders raw keys).
        if (!cancelled) {
          setTranslations((prev) =>
            Object.keys(prev).length > 0 ? prev : flatten(bundledEn as unknown as TranslationMap),
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadTranslations()
    return () => {
      cancelled = true
    }
  }, [locale])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch { /* ignore */ }
    // Mirror to the cookie the middleware reads so SSR + client agree on
    // the locale immediately after toggling (seamless swap, no reload drift).
    try {
      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`
    } catch { /* ignore */ }
    try {
      document.documentElement.lang = locale === "pcm" ? "pcm" : "en"
    } catch { /* ignore */ }
  }, [locale])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const text = translations[key]
      if (!text) return key
      return interpolate(text, params)
    },
    [translations],
  )

  const tf = useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>): string => {
      const text = translations[key]
      if (!text || text === key) return interpolate(fallback, params)
      return interpolate(text, params)
    },
    [translations],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tf, isLoading }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider")
  return ctx
}
