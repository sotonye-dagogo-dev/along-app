export interface SiteReview {
  quote: string;
  initials: string;
  name: string;
  handle: string;
  bg: string;
  color: string;
  stars: number;
}

/** Testimonials shown on the About page. */
export const SITE_REVIEWS: SiteReview[] = [
  {
    quote: "\"Along saved me 40 minutes on my daily commute to VI. The Keke + Bus route nobody knew about is now my go-to.\"",
    initials: "FM",
    name: "Fatima Mohammed",
    handle: "@fatima_commutes",
    bg: "bg-primary-muted",
    color: "text-primary",
    stars: 5,
  },
  {
    quote: "\"The Trust system is a game-changer. I can see which routes are actually used every day vs. someone's one-time shortcut.\"",
    initials: "EK",
    name: "Emeka Kalu",
    handle: "@emeka_routes",
    bg: "bg-info",
    color: "text-info-text",
    stars: 5,
  },
  {
    quote: "\"I discovered that taking a Keke from my street to the BRT stop saves \u20A6200 and 10 minutes. Along changed how I move.\"",
    initials: "AJ",
    name: "Aisha Jibril",
    handle: "@aisha_travels",
    bg: "bg-warning",
    color: "text-warning-text",
    stars: 5,
  },
];
