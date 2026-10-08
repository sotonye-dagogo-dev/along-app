import Link from "next/link";
import { Route, ShieldCheck, Users } from "lucide-react";
import { buildMetadata } from "@/app/lib/utils/metadata";
import { websiteSchema } from "@/app/lib/utils/structuredData";
import { StructuredData } from "@/app/components/ui/StructuredData";
import AppLogo from "../components/ui/AppLogo";
import { HeroCtas, BottomCta } from "@/app/components/ui/LandingCtas";
import { prisma } from "@/app/lib/db/prisma";

export const metadata = buildMetadata({
  title: "Navigate Together",
  description: "Along is a social travel-intelligence platform for sharing, verifying, and discovering transport routes in West Africa.",
  path: "/",
});

type LandingRouteStep = { location?: string; description?: string; vehicle?: string; fare?: string | number };

type LandingPost = {
  id: string;
  title: string;
  routes: unknown;
  likes: number;
  comments: number;
  validityScore: number;
  validityTier: string | null;
  createdAt: Date;
  user: { userName: string; firstName: string; lastName: string };
};

const VEHICLE_CHIPS: Record<string, { bg: string; color: string }> = {
  TAXI: { bg: "#FFFBEB", color: "#92400E" },
  BUS: { bg: "#EFF6FF", color: "#1E40AF" },
  KEKE: { bg: "#F0FDF4", color: "#166534" },
  BIKE: { bg: "#FFF7ED", color: "#9A341E" },
  TREK: { bg: "#F5F5F4", color: "#44403C" },
  CAR: { bg: "#EEF2FF", color: "#3730A3" },
};

async function getLandingPosts(): Promise<LandingPost[]> {
  try {
    return (await prisma.post.findMany({
      where: { type: { in: ["ROUTE", "ROUTE_RESPONSE"] }, isArchived: false },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { user: { select: { userName: true, firstName: true, lastName: true } } },
    })) as unknown as LandingPost[];
  } catch {
    // Fallback for DBs where the additive isArchived column has not migrated yet.
    try {
      return (await prisma.post.findMany({
        where: { type: { in: ["ROUTE", "ROUTE_RESPONSE"] } },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { user: { select: { userName: true, firstName: true, lastName: true } } },
      })) as unknown as LandingPost[];
    } catch {
      return [];
    }
  }
}

interface LandingStats {
  routeCount: number;
  commuterCount: number;
  regions: string[];
}

async function getLandingStats(): Promise<LandingStats> {
  const fallback: LandingStats = { routeCount: 0, commuterCount: 0, regions: [] };
  try {
    const [routeCount, commuterCount, regionRows] = await Promise.all([
      prisma.post
        .count({ where: { isArchived: false } })
        .catch(() => prisma.post.count()),
      prisma.user.count().catch(() => 0),
      prisma.post
        .findMany({
          where: { isArchived: false, region: { not: null } },
          select: { region: true },
          distinct: ["region"],
          take: 3,
        })
        .catch(() =>
          prisma.post
            .findMany({
              where: { region: { not: null } },
              select: { region: true },
              distinct: ["region"],
              take: 3,
            })
            .catch(() => [] as { region: string | null }[]),
        ),
    ]);
    const regions = (regionRows ?? [])
      .map((r) => r.region)
      .filter((r): r is string => Boolean(r));
    return { routeCount, commuterCount, regions };
  } catch {
    return fallback;
  }
}

function formatCompact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function relativeTime(date: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function trustMeta(score: number, tier: string | null): { label: string; bg: string; color: string } {
  const label = tier ? tier.charAt(0) + tier.slice(1).toLowerCase() : score >= 70 ? "Trusted" : score >= 40 ? "Developing" : "Unverified";
  if (score >= 70) return { label, bg: "#D1FAE5", color: "#065F46" };
  if (score >= 40) return { label, bg: "#FEF3C7", color: "#92400E" };
  return { label, bg: "#F3F4F6", color: "#4B5563" };
}

function toPreviewProps(post: LandingPost) {
  const steps = (Array.isArray(post.routes) ? (post.routes as LandingRouteStep[]) : [])
    .filter((r) => r?.location)
    .slice(0, 3)
    .map((r, i) => ({
      num: i + 1,
      text: r.description ? `${r.location} — ${r.description}` : String(r.location),
      fare: r.fare != null && r.fare !== "" ? `₦${r.fare}` : "",
    }));
  const seen = new Set<string>();
  const chips = (Array.isArray(post.routes) ? (post.routes as LandingRouteStep[]) : [])
    .map((r) => (r?.vehicle ?? "").toUpperCase())
    .filter((v) => VEHICLE_CHIPS[v] && !seen.has(v) && seen.add(v) !== undefined)
    .slice(0, 3)
    .map((v) => ({ label: v.charAt(0) + v.slice(1).toLowerCase(), ...VEHICLE_CHIPS[v] }));
  const trust = trustMeta(post.validityScore ?? 0, post.validityTier);
  const fullName = `${post.user.firstName ?? ""} ${post.user.lastName ?? ""}`.trim();
  const initials = (fullName || post.user.userName || "?")
    .split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return {
    initials,
    name: fullName || post.user.userName,
    handle: `@${post.user.userName}`,
    time: relativeTime(post.createdAt),
    chips,
    title: post.title,
    steps,
    likes: post.likes ?? 0,
    comments: post.comments ?? 0,
    trustLabel: trust.label,
    trustScore: Math.round(post.validityScore ?? 0),
    trustBg: trust.bg,
    trustColor: trust.color,
    isSuggestion: false,
  };
}

export default async function LandingPage() {
  const [landingPosts, stats] = await Promise.all([getLandingPosts(), getLandingStats()]);
  const regionLabel = stats.regions.length > 0 ? stats.regions.join(" · ") : "Lagos · Abuja · Port Harcourt";
  return (
    <>
      <StructuredData data={websiteSchema()} />

      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6 py-12 overflow-hidden"
        style={{ background: "linear-gradient(135deg,#004A2C 0%,#00623B 50%,#00A862 100%)" }}
      >
        <div className="pointer-events-none">
          <AppLogo variant="full" size="md" className="w-full" linkTo="" />
        </div>
        <h1 className="text-white font-extrabold tracking-tight leading-tight mb-3 text-[clamp(32px,5vw,48px)]">
          Navigate Together.
        </h1>
        <p className="text-white/80 text-[clamp(14px,2vw,16px)] max-w-[480px] mb-8 leading-relaxed">
          Share routes. Discover better ways. Together.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <HeroCtas />
        </div>
        <Link href="/home" className="mt-5 inline-block text-sm text-white/70 hover:text-white transition-colors underline underline-offset-2">
          Continue as guest
        </Link>
      </section>

      {/* Features */}
      <section className="py-6 sm:py-8 px-5 bg-bg-base">
        <div className="max-w-[400px] sm:max-w-[960px] mx-auto grid gap-5 sm:grid-cols-3">
          <FeatureCard
            icon={<Route size={24} />}
            title="Share Routes"
            description="Post your daily commute routes with step-by-step directions and fare info."
          />
          <FeatureCard
            icon={<ShieldCheck size={24} />}
            title="Trust Scores"
            description="Community-verified route validity so you know what's real and what's not."
          />
          <FeatureCard
            icon={<Users size={24} />}
            title="Community"
            description="Join thousands of Lagos commuters sharing real-time route intelligence."
          />
        </div>
      </section>

      {/* Social Proof — real platform stats, never hardcoded marketing numbers */}
      <section className="py-6 px-5 text-center glass">
        <p className="text-sm font-medium text-text-secondary tracking-wide">
          <strong className="text-primary">{formatCompact(stats.routeCount)}+</strong> Routes &middot;{" "}
          <strong className="text-primary">{formatCompact(stats.commuterCount)}+</strong> Commuters &middot;{" "}
          {regionLabel}
        </p>
      </section>

      {/* Feed Preview */}
      <section className="py-6 sm:py-8 px-5 bg-bg-elevated">
        <div className="max-w-[640px] mx-auto flex flex-col gap-5">
          <span className="text-xs font-medium text-text-muted tracking-wide uppercase">
            Recent from the community
          </span>
          {landingPosts.length > 0 ? (
            landingPosts.map((post) => <PostPreviewCard key={post.id} {...toPreviewProps(post)} />)
          ) : (
            <div className="bg-bg-card border border-border rounded-xl px-4 py-6 text-center text-sm text-text-muted">
              No routes shared yet —{" "}
              <Link href="/register" className="text-primary font-semibold hover:underline">
                be the first to share one
              </Link>
              .
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section
        className="py-8 sm:py-10 px-5 text-center"
        style={{ background: "linear-gradient(135deg,#004A2C 0%,#00623B 50%,#00A862 100%)" }}
      >
        <h2 className="text-[clamp(24px,4vw,36px)] font-bold tracking-tight text-white mb-6">
          Start navigating smarter
        </h2>
        <BottomCta />
      </section>
    </>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-bg-elevated border border-border rounded-xl p-6 text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-base">
      <div className="w-12 h-12 rounded-xl bg-primary-muted flex items-center justify-center mx-auto mb-4 text-primary">
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed max-w-[280px] mx-auto">{description}</p>
    </div>
  );
}

function PostPreviewCard({
  initials, name, handle, time, chips, title, steps, likes, comments,
  trustLabel, trustScore, trustBg, trustColor, isSuggestion,
}: {
  initials: string; name: string; handle: string; time: string;
  chips: { label: string; bg: string; color: string }[];
  title: string; steps: { num: number; text: string; fare: string }[];
  likes: number; comments: number;
  trustLabel: string; trustScore: number; trustBg: string; trustColor: string;
  isSuggestion: boolean;
}) {
  return (
    <div className={
      "bg-bg-card border border-border rounded-xl shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-base overflow-hidden" +
      (isSuggestion ? " border-l-4 border-l-primary bg-primary-muted" : "")
    }>
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
        <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center text-base font-bold text-primary shrink-0">
          {isSuggestion ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary"><path d="M12 3v18"/><path d="M3 12h18"/></svg>
          ) : initials}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-xs" style={{ color: isSuggestion ? "var(--color-primary)" : "var(--color-text-secondary)" }}>
            {handle}
          </div>
        </div>
        <div className="text-xs text-text-muted ml-auto">{time}</div>
      </div>
      {isSuggestion && (
        <div className="inline-flex items-center gap-1 px-3 py-0.5 ml-4 mb-2 rounded-full text-[11px] font-semibold text-primary bg-primary-muted">
          <svg viewBox="0 0 24 24" className="w-3 h-3"><path d="M12 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z"/></svg>
          Recommended
        </div>
      )}
      {!isSuggestion && chips.length > 0 && (
        <div className="flex gap-1.5 px-4 pb-2.5 flex-wrap">
          {chips.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: c.bg, color: c.color }}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}
      <div className="text-base sm:text-lg font-semibold px-4 pb-2">{title}</div>
      <div className="flex flex-col gap-2 px-4 pb-3">
        {steps.map((s) => (
          <div key={s.num} className="flex items-start gap-2.5 relative">
            <div className="w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center shrink-0 z-10">
              {s.num}
            </div>
            <span className="text-xs flex-1 text-text-primary">{s.text}</span>
            <span className="text-xs font-semibold text-text-primary shrink-0">{s.fare}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 px-4 py-2 border-t border-border">
        <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-text-secondary hover:bg-bg-elevated transition-colors cursor-pointer">
          <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          {likes}
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-text-secondary hover:bg-bg-elevated transition-colors cursor-pointer">
          <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          {comments}
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-text-secondary hover:bg-bg-elevated transition-colors cursor-pointer ml-auto">
          <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
        </span>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ background: trustBg, color: trustColor }}
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          {trustLabel} {trustScore}
        </span>
      </div>
    </div>
  );
}
