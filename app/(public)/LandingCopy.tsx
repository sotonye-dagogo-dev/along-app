"use client";

import { Route, ShieldCheck, Users } from "lucide-react";
import { useTranslation } from "@/app/providers/I18nProvider";

/** Client copy islands for the (server) landing page — dictionary-driven
 *  with English fallbacks so the hero never renders raw keys offline. */

export function LandingHeroCopy() {
  const { tf } = useTranslation();
  return (
    <>
      <h1 className="text-white font-extrabold tracking-tight leading-tight mb-3 text-[clamp(32px,5vw,48px)]">
        {tf("landing.hero.title", "Navigate Together.")}
      </h1>
      <p className="text-white/80 text-[clamp(14px,2vw,16px)] max-w-[480px] mb-8 leading-relaxed">
        {tf("landing.hero.subtitle", "Share routes. Discover better ways. Together.")}
      </p>
    </>
  );
}

export function LandingFeatures() {
  const { tf } = useTranslation();
  const cards = [
    {
      icon: <Route size={24} />,
      title: tf("landing.feature.shareRoutes", "Share Routes"),
      description: tf(
        "landing.feature.shareRoutesDesc",
        "Post your daily commute routes with step-by-step directions and fare info.",
      ),
    },
    {
      icon: <ShieldCheck size={24} />,
      title: tf("landing.feature.trustScores", "Trust Scores"),
      description: tf(
        "landing.feature.trustScoresDesc",
        "Community-verified route validity so you know what's real and what's not.",
      ),
    },
    {
      icon: <Users size={24} />,
      title: tf("landing.feature.community", "Community"),
      description: tf(
        "landing.feature.communityDesc",
        "Join thousands of Lagos commuters sharing real-time route intelligence.",
      ),
    },
  ];
  return (
    <div className="max-w-[400px] sm:max-w-[960px] mx-auto grid gap-5 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.title}
          className="bg-bg-elevated border border-border rounded-xl p-6 text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-base"
        >
          <div className="w-12 h-12 rounded-xl bg-primary-muted flex items-center justify-center mx-auto mb-4 text-primary">
            {c.icon}
          </div>
          <h3 className="text-base font-semibold mb-1.5">{c.title}</h3>
          <p className="text-sm text-text-secondary leading-relaxed max-w-[280px] mx-auto">{c.description}</p>
        </div>
      ))}
    </div>
  );
}

export function LandingCtaHeading() {
  const { tf } = useTranslation();
  return (
    <h2 className="text-[clamp(24px,4vw,36px)] font-bold tracking-tight text-white mb-6">
      {tf("landing.cta.title", "Start navigating smarter")}
    </h2>
  );
}

export function LandingFeedPreviewHeading() {
  const { tf } = useTranslation();
  return (
    <span className="text-xs font-medium text-text-muted tracking-wide uppercase">
      {tf("landing.feedPreview", "Recent from the community")}
    </span>
  );
}

export function LandingFeedEmpty() {
  const { tf } = useTranslation();
  return (
    <>
      {tf("landing.feedEmpty", "No routes shared yet —")}{" "}
      <a href="/register" className="text-primary font-semibold hover:underline">
        {tf("landing.feedEmptyCta", "be the first to share one")}
      </a>
      .
    </>
  );
}
