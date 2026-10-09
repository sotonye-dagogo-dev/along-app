"use client"

import { useContext } from "react"
import Link from "next/link"
import { AuthContext } from "@/app/providers/AuthProvider"
import { useTranslation } from "@/app/providers/I18nProvider"

export function HeroCtas() {
  const auth = useContext(AuthContext)
  const { tf } = useTranslation()
  const isAuth = auth?.isAuthenticated ?? false
  const isLoading = auth?.isLoading ?? true

  if (isLoading) {
    return <div className="h-12 w-56 bg-white/20 rounded-md animate-pulse mx-auto" />
  }

  if (isAuth) {
    return (
      <Link
        href="/home"
        className="inline-flex items-center gap-2 h-12 px-6 rounded-md bg-white text-primary text-base font-semibold hover:shadow-lg transition-shadow"
      >
        {tf("landing.cta.continueToFeed", "Continue to feed")} &rarr;
      </Link>
    )
  }

  return (
    <>
      <Link
        href="/register"
        className="inline-flex items-center gap-2 h-12 px-6 rounded-md bg-white text-primary text-base font-semibold hover:shadow-lg transition-shadow"
      >
        {tf("landing.hero.getStarted", "Get Started →").replace(" →", "")} &rarr;
      </Link>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 h-12 px-6 rounded-md bg-transparent text-white text-base font-medium border border-white/40 hover:bg-white/10 transition-colors"
      >
        {tf("landing.hero.signIn", "Sign In")}
      </Link>
    </>
  )
}

export function BottomCta() {
  const auth = useContext(AuthContext)
  const { tf } = useTranslation()
  const isAuth = auth?.isAuthenticated ?? false
  const isLoading = auth?.isLoading ?? true

  if (isLoading) {
    return <div className="h-12 w-56 bg-white/20 rounded-md animate-pulse mx-auto" />
  }

  if (isAuth) {
    return (
      <Link
        href="/home"
        className="inline-flex items-center gap-2 h-12 px-7 rounded-md bg-white text-primary text-base font-semibold hover:shadow-lg transition-shadow"
      >
        {tf("landing.cta.continueToFeed", "Continue to feed")} &rarr;
      </Link>
    )
  }

  return (
    <Link
      href="/register"
      className="inline-flex items-center gap-2 h-12 px-7 rounded-md bg-white text-primary text-base font-semibold hover:shadow-lg transition-shadow"
    >
      {tf("landing.cta.createAccount", "Create Free Account →").replace(" →", "")} &rarr;
    </Link>
  )
}

/**
 * "Continue as guest" hero link. Mirrors the HeroCtas/BottomCta auth gate:
 * authenticated users already get "View Feed", so the guest link hides for
 * them (same `isAuthenticated` source of truth, no divergent logic).
 * Renders nothing while auth resolves to avoid a flash of the wrong state.
 */
export function GuestContinueLink() {
  const auth = useContext(AuthContext)
  const { tf } = useTranslation()
  const isAuth = auth?.isAuthenticated ?? false
  const isLoading = auth?.isLoading ?? true

  if (isLoading || isAuth) return null

  return (
    <Link
      href="/home"
      className="mt-5 inline-block text-sm text-white/70 hover:text-white transition-colors underline underline-offset-2"
    >
      {tf("auth.continueAsGuest", "Continue as guest")}
    </Link>
  )
}
