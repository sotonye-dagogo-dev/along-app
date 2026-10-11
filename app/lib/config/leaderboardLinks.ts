/**
 * Leaderboard cross-links (config-driven, zero app deps).
 *
 * Single source of truth for every surface that points at the global
 * leaderboard (`/leaderboard`). Footer, profile quick-links and the
 * invite page all read from here so the route can never drift.
 */
export const LEADERBOARD_LINKS_CONFIG = {
  /** Canonical global leaderboard route (protected, see middleware). */
  route: "/leaderboard",
  footer: {
    label: "Leaderboard",
    href: "/leaderboard",
    i18nKey: "footer.leaderboard",
  },
  profileQuickLink: {
    id: "leaderboard",
    label: "Leaderboard",
    href: "/leaderboard",
    i18nKey: "profile.leaderboard",
  },
  inviteCta: {
    label: "View full leaderboard",
    href: "/leaderboard",
    i18nKey: "invite.viewLeaderboard",
  },
} as const;
