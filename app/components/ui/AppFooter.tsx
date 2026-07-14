import Link from "next/link";
import { FOOTER_CONFIG } from "@/app/lib/config";
import LocaleSwitcher from "./LocaleSwitcher";

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-bg-card">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-3 gap-8 mb-8">
          {FOOTER_CONFIG.columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-semibold text-sm mb-3 text-text-primary">
                {column.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-base"
                    >
                      {link.label}
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
            &copy; {new Date().getFullYear()} Along. All rights reserved.
          </p>
          <p className="text-xs opacity-60 hover:opacity-100 transition-opacity duration-base mt-1">
            Built by{" "}
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
