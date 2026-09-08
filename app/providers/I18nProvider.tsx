"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { Locale, TranslationMap } from "@/app/lib/config/i18n"
import { DEFAULT_LOCALE, STORAGE_KEY } from "@/app/lib/config/i18n"

type Translations = Record<string, string>

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  isLoading: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)



function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [translations, setTranslations] = useState<Translations>({})
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
    const loadTranslations = async () => {
      try {
        const res = await fetch(`/locales/${locale}.json`)
        const data: TranslationMap = await res.json()
        const flat: Translations = {}
        const flatten = (obj: Record<string, unknown>, prefix = "") => {
          for (const [key, value] of Object.entries(obj)) {
            if (typeof value === "string") {
              flat[prefix + key] = value
            } else if (typeof value === "object" && value !== null) {
              flatten(value as Record<string, unknown>, prefix + key + ".")
            }
          }
        }
        flatten(data)
        setTranslations(flat)
      } catch {
        setTranslations({})
      } finally {
        setIsLoading(false)
      }
    }
    loadTranslations()
  }, [locale])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
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

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, isLoading }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider")
  return ctx
}
