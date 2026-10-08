import Link from "next/link";
import { AppFooter } from "@/app/components/ui/AppFooter";
import AppLogo from "@/app/components/ui/AppLogo";
import PublicNavActions from "@/app/components/ui/PublicNavActions";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg-base">
      <header className="sticky top-0 z-40 bg-bg-base/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <AppLogo size="md" variant="icon" />
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <nav className="hidden sm:flex items-center gap-6 text-sm">
              <Link href="/about" className="text-text-secondary hover:text-text-primary transition-colors">About</Link>
              <Link href="/faq" className="text-text-secondary hover:text-text-primary transition-colors">FAQ</Link>
              <Link href="/blog" className="text-text-secondary hover:text-text-primary transition-colors">Blog</Link>
              <Link href="/contact" className="text-text-secondary hover:text-text-primary transition-colors">Contact</Link>
            </nav>
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <PublicNavActions />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
