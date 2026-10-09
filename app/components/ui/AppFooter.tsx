"use client";

import Link from "next/link";
import { FOOTER_CONFIG } from "@/app/lib/config";
import { useTranslation } from "@/app/providers/I18nProvider";
import LocaleSwitcher from "./LocaleSwitcher";

export function AppFooter() {
  // Config-driven links with pidgin overrides — config labels are the
  // fallback so footer links never render raw keys (online or offline).
  const { tf } = useTranslation();
  const tLink = (key: string, fallback: string) => tf(key, fallback);
  const gridClass = FOOTER_CONFIG.layout?.gridClass ?? "grid grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-8"
  const linkListClass = FOOTER_CONFIG.layout?.linkListClass ?? "flex flex-col gap-2"
  return (
    <footer className="border-t border-border bg-bg-card">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className={gridClass}>
          {FOOTER_CONFIG.columns.map((column) => (
            <div key={column.title} className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm mb-3 text-text-primary truncate">
                {column.i18nKey ? tLink(column.i18nKey, column.title) : column.title}
              </h3>
              <ul className={linkListClass}>
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs sm:text-sm text-text-secondary hover:text-text-primary transition-colors duration-base break-words"
                    >
                      {link.i18nKey ? tLink(link.i18nKey, link.label) : link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 mb-6">
          {FOOTER_CONFIG.socials.map((social) => {
            const Icon = social.icon;
            return (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="text-text-muted hover:text-text-primary transition-colors duration-base"
              >
                <Icon size={20} />
              </a>
            );
          })}
        </div>

        <div className="flex justify-center mt-2 mb-4">
          <LocaleSwitcher />
        </div>

        <div className="text-center pt-4 border-t border-border">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} Along. {tLink("footer.rights", "All rights reserved.")}
          </p>
          <p className="text-xs opacity-60 hover:opacity-100 transition-opacity duration-base mt-1">
            {tLink("footer.builtBy", "Built by")}{" "}
            <a
              href="https://sotonye-dagogo.is-a.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              S.D
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
