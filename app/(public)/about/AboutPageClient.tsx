"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Route, Activity, Star, MessageSquareHeart } from "lucide-react";
import { TEAM_MEMBERS, ENDLESS_CAROUSEL_CONFIG, insertReviewCtaPanels, reviewAuthorName, REVIEWS_CONFIG } from "@/app/lib/config";
import type { PlatformReviewItem } from "@/app/lib/config";
import { useTranslation } from "@/app/providers/I18nProvider";
import { useAuth } from "@/app/hooks/useAuth";
import { EndlessCarousel } from "@/app/components/features/suggestions/EndlessCarousel";
import { AppAvatar } from "@/app/components/ui";

export default function AboutPageClient() {
  const { tf } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState<PlatformReviewItem[] | null>(null);

  // Real, moderated platform reviews (GET is SW-cached, so this works
  // offline from cache). Placeholder SITE_REVIEWS are retired from display.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reviews?limit=${REVIEWS_CONFIG.maxListLimit}`)
      .then((res) => (res.ok ? res.json() : { reviews: [] }))
      .then((data) => {
        if (!cancelled) setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // Dictionary-driven with config-literal fallbacks (never raw keys offline).
  const FEATURES = [
    {
      icon: <Route size={22} />,
      title: tf("about.feature.community", "Community-Driven"),
      description: tf("about.feature.communityDesc", "Every route is posted, validated, and rated by real commuters. No algorithms — just people sharing what they know."),
    },
    {
      icon: <ShieldCheck size={22} />,
      title: tf("about.feature.trust", "Trusted Intelligence"),
      description: tf("about.feature.trustDesc", "Our validity system scores every route on community, detail, corroboration, and recency. Know what works before you go."),
    },
    {
      icon: <Activity size={22} />,
      title: tf("about.feature.multimodal", "Multi-Modal"),
      description: tf("about.feature.multimodalDesc", "Taxi, Bus, Keke, Bike, Trek — the fastest route might combine three modes. Along connects them into one journey."),
    },
  ];
  // Reviews ride the same EndlessCarousel tape as the home suggestions rail —
  // one wrapper, one animation/physics implementation, reused everywhere.
  // CTA panels interleave per REVIEWS_CONFIG cadence (end / midpoint / every 10).
  const stream = insertReviewCtaPanels(reviews ?? []);
  const reviewItems = stream.map((entry, i) =>
    entry.kind === "cta" ? (
      <ReviewCtaPanel key={`cta-${i}`} isAuthenticated={isAuthenticated} />
    ) : (
      <ReviewCard key={entry.review.id} review={entry.review} />
    ),
  );

  return (
    <div className="flex flex-col gap-12 pb-16">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl py-20 px-6 text-center text-white"
        style={{ background: "linear-gradient(135deg,var(--color-primary-dark),var(--color-primary) 50%,var(--color-primary-light))" }}
      >
        <div className="absolute opacity-8 pointer-events-none">
          <svg viewBox="0 0 400 400" width="400" height="400">
            <circle cx="80" cy="80" r="40" fill="#fff"/>
            <circle cx="200" cy="320" r="30" fill="#fff"/>
            <circle cx="320" cy="60" r="25" fill="#fff"/>
            <path d="M80 80 L200 320 L320 60" stroke="#fff" strokeWidth="2" strokeDasharray="6 6" opacity="0.5"/>
          </svg>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-3 relative z-10">
          {tf("about.hero.title", "Our Story")}
        </h1>
        <p className="text-white/80 text-base max-w-[560px] mx-auto relative z-10">
          {tf("about.hero.subtitle", "Along was born in Lagos, built for the millions of daily commuters navigating West Africa's most dynamic cities. We turn shared experience into reliable route intelligence.")}
        </p>
      </section>

      {/* Features */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{tf("about.why.title", "Why Along")}</h2>
          <p className="text-sm text-text-secondary max-w-[500px] mx-auto">
            {tf("about.why.subtitle", "Three things that make route intelligence work for real commuters")}
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3.5 items-start">
              <div className="w-11 h-11 rounded-xl bg-primary-muted text-primary flex items-center justify-center shrink-0">
                {f.icon}
              </div>
              <div>
                <div className="text-sm font-semibold mb-1">{f.title}</div>
                <div className="text-xs text-text-secondary leading-relaxed">{f.description}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Team Grid */}
      <section className="max-w-[1100px] mx-auto px-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{tf("about.team.title", "Meet the Team")}</h2>
          <p className="text-sm text-text-secondary max-w-[500px] mx-auto">
            {tf("about.team.subtitle", "Built by people who commute every day")}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TEAM_MEMBERS.map((member) => {
            const initials = member.name.split(" ").map((n) => n[0]).join("");
            return (
              <div
                key={member.name}
                className="bg-bg-card border border-border rounded-2xl p-6 text-center shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-base"
              >
                {member.avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-20 h-20 rounded-full mx-auto mb-3 object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold bg-primary text-white">
                    {initials}
                  </div>
                )}
                <div className="text-base sm:text-lg font-semibold mb-0.5">{member.name}</div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-muted text-primary mb-2.5">
                  {member.role}
                </span>
                <div className="text-xs text-text-secondary leading-relaxed mb-3">{member.bio}</div>
                {member.socials && member.socials.length > 0 && (
                  <div className="flex justify-center gap-2.5">
                    {member.socials.map((s) => (
                      <a
                        key={s.platform}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.platform}
                        className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary-muted transition-all"
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {s.platform === "github" ? (
                            <>
                              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                            </>
                          ) : (
                            <>
                              <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
                            </>
                          )}
                        </svg>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Reviews Carousel — real moderated reviews + CTA panels, same
          EndlessCarousel design/animation as home */}
      <section className="bg-primary-muted py-12">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{tf("about.reviews.title", "What Commuters Say")}</h2>
            <p className="text-sm text-text-secondary max-w-[500px] mx-auto">
              {tf("about.reviews.subtitle", "Real riders, real routes, real feedback")}
            </p>
          </div>
          {reviews === null ? (
            <div className="flex gap-4 overflow-hidden" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-[280px] sm:w-[320px] h-[180px] rounded-2xl bg-bg-card/60 animate-pulse shrink-0" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-text-secondary">
                {tf("about.reviews.empty", "No reviews yet — yours could be the first.")}
              </p>
              <ReviewCtaPanel isAuthenticated={isAuthenticated} />
            </div>
          ) : (
            <EndlessCarousel
              items={reviewItems}
              label="Commuter reviews"
              durationSec={ENDLESS_CAROUSEL_CONFIG.defaultDurationSec}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function ReviewCard({ review: r }: { review: PlatformReviewItem }) {
  const { tf } = useTranslation();
  const name = reviewAuthorName(r.reviewer);
  return (
    <div className="w-[280px] sm:w-[320px] glass rounded-2xl p-7 shrink-0">
      <div className="flex gap-0.5 mb-3" aria-label={`${r.rating} out of 5 stars`}>
        {Array.from({ length: REVIEWS_CONFIG.maxRating }).map((_, i) => (
          <Star key={i} size={16} className={i < r.rating ? "fill-warning-border text-warning-border" : "text-text-muted"} />
        ))}
      </div>
      {r.comment ? (
        <div className="text-sm text-text-primary leading-relaxed mb-4 italic">
          &ldquo;{r.comment}&rdquo;
        </div>
      ) : (
        <div className="text-sm text-text-muted leading-relaxed mb-4 italic">
          {tf("about.reviewNoComment", "Rated Along {stars} out of 5.", { stars: r.rating })}
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <AppAvatar
          src={r.reviewer.avatar ?? undefined}
          alt={name}
          size={32}
          config={(r.reviewer.avatarConfig ?? undefined) as { style: string; seed?: string; flip?: boolean; backgroundColor?: string } | undefined}
          userName={r.reviewer.userName}
        />
        <div>
          <div className="text-xs font-semibold">{name}</div>
          <div className="text-[11px] text-text-muted">@{r.reviewer.userName || "deleted-user"}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * CTA panel interleaved in the reviews tape. Authenticated users land on
 * their profile Reviews tab (via #reviews deep link); guests go to sign up.
 */
function ReviewCtaPanel({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { tf } = useTranslation();
  return (
    <div className="w-[280px] sm:w-[320px] rounded-2xl p-7 shrink-0 flex flex-col items-center justify-center text-center gap-3 bg-primary text-white">
      <MessageSquareHeart size={28} aria-hidden />
      <div className="text-base font-bold">{tf("about.reviewCta.title", "Used Along today?")}</div>
      <p className="text-xs text-white/85 leading-relaxed">
        {tf("about.reviewCta.body", "Tell commuters how it went — your rating keeps routes honest.")}
      </p>
      <Link
        href={isAuthenticated ? "/profile#reviews" : "/register"}
        className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-primary text-xs font-bold no-underline hover:opacity-90"
      >
        {isAuthenticated
          ? tf("about.reviewCta.leave", "Leave a review")
          : tf("about.reviewCta.signIn", "Sign in to leave a review")}
      </Link>
    </div>
  );
}
