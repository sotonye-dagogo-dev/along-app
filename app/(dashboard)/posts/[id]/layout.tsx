import type { Metadata } from "next";
import { prisma } from "@/app/lib/db/prisma";
import { buildPostMetadata } from "@/app/lib/utils/metadata";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  let post: {
    title: string;
    description?: string | null;
    type?: string | null;
    images?: string[] | null;
    createdAt: Date;
    user?: { firstName: string; userName: string } | null;
  } | null = null;

  try {
    post = await prisma.post.findUnique({
      where: { id },
      select: {
        title: true,
        description: true,
        type: true,
        images: true,
        createdAt: true,
        user: { select: { firstName: true, userName: true } },
      },
    });
  } catch {
    // DB unavailable
  }

  const sanitizedPost = post
    ? {
        title: post.title,
        description: post.description ?? undefined,
        type: post.type ?? undefined,
        images: post.images ?? undefined,
        createdAt: post.createdAt,
        user: post.user ?? undefined,
      }
    : null;
  return buildPostMetadata(sanitizedPost, `/posts/${id}`);
}

export default function PostDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
