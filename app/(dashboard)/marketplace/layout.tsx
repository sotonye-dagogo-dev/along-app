import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Route guides, tours, and tickets",
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
