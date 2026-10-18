import type { Metadata } from "next";
import AdminShell from "./AdminShell";

export const metadata: Metadata = {
  // Bare title — the root layout title.template appends ` | Along` once.
  title: "Admin",
  description: "Platform administration and moderation.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
