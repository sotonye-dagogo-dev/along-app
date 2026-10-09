import en from "@/public/locales/en.json";
import pcm from "@/public/locales/pcm.json";

const REQUIRED_KEYS = [
  "pwa.offlineBanner",
  "pwa.backOnline",
  "pwa.cachedNotice",
  "pwa.retry",
  "pwa.offlineTitle",
  "pwa.installTitle",
  "pwa.installCta",
  "push.enablePrompt",
  "push.enable",
  "push.blocked",
  "offline.cachedFeed",
  "offline.queueNote",
  "common.searchPlaceholder",
  "common.commentPlaceholder",
  "common.sharePlaceholder",
  "common.offlineBlocked",
  "notifications.title",
  "profile.signOut",
  // Tightening-up coverage: collapsible banner, config-driven pages, reviews.
  "pwa.collapse",
  "pwa.expand",
  "pwa.collapsedLabel",
  "about.hero.title",
  "about.reviews.title",
  "about.reviewCta.leave",
  "about.reviewNoComment",
  "faq.title",
  "faq.searchPlaceholder",
  "feed.title",
  "leaderboard.title",
  "leaderboard.empty",
  "invite.title",
  "invite.copyLink",
  "invite.noInvites",
  "reviews.tab",
  "reviews.formTitle",
  "reviews.submit",
  "reviews.thanks",
  "reviews.ratingRequired",
  "footer.company",
  "footer.features",
  "footer.joinDiscord",
  "footer.rights",
  "empty.feed.title",
  "common.moreOptions",
  "post.unarchive",
];

describe("locale parity (en/pcm)", () => {
  it("shares identical key sets", () => {
    const enKeys = Object.keys(en).sort();
    const pcmKeys = Object.keys(pcm as Record<string, string>).sort();
    expect(pcmKeys).toEqual(enKeys);
  });

  it("covers all PWA/offline/push/placeholder keys in both locales", () => {
    for (const key of REQUIRED_KEYS) {
      expect((en as Record<string, string>)[key]).toBeTruthy();
      expect((pcm as Record<string, string>)[key]).toBeTruthy();
    }
  });

  it("pidgin translations differ from english (actually translated)", () => {
    const e = en as Record<string, string>;
    const p = pcm as Record<string, string>;
    const differing = ["pwa.offlineBanner", "pwa.cachedNotice", "offline.cachedFeed", "push.enablePrompt"].filter(
      (k) => p[k] !== e[k],
    );
    expect(differing.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves {param} interpolation placeholders across locales", () => {
    const e = en as Record<string, string>;
    const p = pcm as Record<string, string>;
    for (const key of Object.keys(e)) {
      const eParams = [...e[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const pParams = [...(p[key] ?? "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect({ key, pParams }).toEqual({ key, pParams: eParams });
    }
  });
});
