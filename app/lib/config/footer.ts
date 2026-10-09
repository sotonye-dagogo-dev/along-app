import { Github, Twitter, Mail } from "lucide-react";

interface FooterLink {
  label: string;
  href: string;
  /** Optional i18n key for pidgin/dictionary overrides (label = fallback). */
  i18nKey?: string;
}

interface FooterColumn {
  title: string;
  /** Optional i18n key for the column heading (title = fallback). */
  i18nKey?: string;
  links: FooterLink[];
}

interface SocialLink {
  icon: typeof Github;
  href: string;
  label: string;
}

interface FooterLayout {
  /** Grid wrapper for the link columns — 3 cols on mobile and up. */
  gridClass: string;
  /** Stack for links inside each column. */
  linkListClass: string;
}

interface FooterConfig {
  columns: FooterColumn[];
  socials: SocialLink[];
  copyright: string;
  layout: FooterLayout;
  devCredit: {
    label: string;
    href: string;
  };
}

export const FOOTER_CONFIG: FooterConfig = {
  columns: [
    {
      title: "Along",
      i18nKey: "footer.company",
      links: [
        { label: "About", href: "/about", i18nKey: "footer.about" },
        { label: "Contact", href: "/contact", i18nKey: "footer.contact" },
        { label: "Privacy Policy", href: "/privacy", i18nKey: "footer.privacy" },
        { label: "Terms of Service", href: "/terms", i18nKey: "footer.terms" },
      ],
    },
    {
      title: "Features",
      i18nKey: "footer.features",
      links: [
        { label: "Explore Routes", href: "/explore", i18nKey: "footer.exploreRoutes" },
        { label: "Share Route", href: "/home", i18nKey: "nav.shareRoute" },
        { label: "Notifications", href: "/notifications", i18nKey: "footer.notifications" },
        { label: "Invite Friends", href: "/invite", i18nKey: "footer.inviteFriends" },
      ],
    },
    {
      title: "Community",
      i18nKey: "footer.community",
      links: [
        { label: "Blog", href: "/blog", i18nKey: "footer.blog" },
        { label: "FAQ", href: "/faq", i18nKey: "footer.faq" },
        { label: "Report a Bug", href: "/report-bug", i18nKey: "footer.reportBug" },
        { label: "Join Discord", href: "https://discord.gg/along", i18nKey: "footer.joinDiscord" },
      ],
    },
  ],
  socials: [
    { icon: Github, href: "https://github.com/along-app", label: "GitHub" },
    { icon: Twitter, href: "https://twitter.com/along_app", label: "Twitter" },
    { icon: Mail, href: "mailto:alongtoanywhere@gmail.com", label: "Email" },
  ],
  copyright: "Along. All rights reserved.",
  layout: {
    gridClass: "grid grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-8",
    linkListClass: "flex flex-col gap-2",
  },
  devCredit: {
    label: "Built by S.D",
    href: "https://sotonye-dagogo.is-a.dev",
  },
};
