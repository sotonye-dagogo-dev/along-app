import { Github, Twitter, Mail } from "lucide-react";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
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
      links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
    {
      title: "Features",
      links: [
        { label: "Explore Routes", href: "/explore" },
        { label: "Share Route", href: "/home" },
        { label: "Notifications", href: "/notifications" },
        { label: "Invite Friends", href: "/invite" },
      ],
    },
    {
      title: "Community",
      links: [
        { label: "Blog", href: "/blog" },
        { label: "FAQ", href: "/faq" },
        { label: "Report a Bug", href: "/report-bug" },
        { label: "Join Discord", href: "https://discord.gg/along" },
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
