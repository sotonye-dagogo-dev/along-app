import type { Metadata } from "next";
import { prisma } from "@/app/lib/db/prisma";
import { buildProfileMetadata } from "@/app/lib/utils/metadata";

type Props = {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  let profile: {
    firstName: string;
    lastName: string;
    userName: string;
    bio?: string | null;
    avatar?: string | null;
  } | null = null;

  try {
    profile = await prisma.user.findUnique({
      where: { userName: username },
      select: { firstName: true, lastName: true, userName: true, bio: true, avatar: true },
    });
  } catch {
    // DB unavailable
  }

  return buildProfileMetadata(profile, `/profile/${username}`);
}

export default function ProfileDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
