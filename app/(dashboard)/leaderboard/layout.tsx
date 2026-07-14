import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Top contributors ranked by reward points",
}

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
