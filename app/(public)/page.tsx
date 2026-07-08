import Link from "next/link";
import { Route, ShieldCheck, Users } from "lucide-react";
import { buildMetadata } from "@/app/lib/utils/metadata";
import { websiteSchema } from "@/app/lib/utils/structuredData";
import { StructuredData } from "@/app/components/ui/StructuredData";
import AppLogo from "../components/ui/AppLogo";
import { HeroCtas, BottomCta } from "@/app/components/ui/LandingCtas";

export const metadata = buildMetadata({
  title: "Navigate Together",
  description: "Along is a social travel-intelligence platform for sharing, verifying, and discovering transport routes in West Africa.",
  path: "/",
});

export default function LandingPage() {
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

      {/* Social Proof */}
      <section className="py-6 px-5 text-center glass">
        <p className="text-sm font-medium text-text-secondary tracking-wide">
          <strong className="text-primary">10,000+</strong> Routes &middot;{" "}
          <strong className="text-primary">50,000+</strong> Commuters &middot;{" "}
          Lagos &middot; Abuja &middot; Port Harcourt
        </p>
      </section>

      {/* Feed Preview */}
      <section className="py-6 sm:py-8 px-5 bg-bg-elevated">
        <div className="max-w-[640px] mx-auto flex flex-col gap-5">
          <span className="text-xs font-medium text-text-muted tracking-wide uppercase">
            Recent from the community
          </span>
          <PostPreviewCard
            initials="TC"
            name="Tega C."
            handle="@tega_c"
            time="12m"
            chips={[
              { label: "Taxi", bg: "#FFFBEB", color: "#92400E" },
              { label: "Keke", bg: "#F0FDF4", color: "#166534" },
            ]}
            title="Yaba \u2192 CMS via Third Mainland"
            steps={[
              { num: 1, text: "Yaba \u2014 start at Unilag gate", fare: "\u20A6200" },
              { num: 2, text: "Third Mainland Bridge \u2014 drop at Adeniji", fare: "\u20A6300" },
              { num: 3, text: "CMS \u2014 final stop at Marina", fare: "\u20A6150" },
            ]}
            likes={42}
            comments={12}
            trustLabel="Trusted"
            trustScore={78}
            trustBg="#D1FAE5"
            trustColor="#065F46"
            isSuggestion={false}
          />
          <PostPreviewCard
            initials=""
            name="Along Suggestion"
            handle="Curated route"
            time="2h"
            chips={[]}
            title="Ikeja \u2192 Oshodi \u2014 Quick Alternative"
            steps={[
              { num: 1, text: "Ikeja Alausa \u2014 bus stop", fare: "\u20A6150" },
              { num: 2, text: "Oshodi-Apapa express \u2014 drop at Oshodi", fare: "\u20A6200" },
            ]}
            likes={28}
            comments={8}
            trustLabel="Developing"
            trustScore={45}
            trustBg="#FEF3C7"
            trustColor="#92400E"
            isSuggestion={true}
          />
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
