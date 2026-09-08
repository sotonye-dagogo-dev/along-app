import type { MetadataRoute } from "next";
import { prisma } from "@/app/lib/db/prisma";
import { DEFAULT_META } from "@/app/lib/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = DEFAULT_META.url;

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/explore`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  ];

  const dynamicPages: MetadataRoute.Sitemap = [];

  try {
    const posts = await prisma.post.findMany({
      where: {},
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    });

    for (const post of posts) {
      dynamicPages.push({
        url: `${baseUrl}/posts/${post.id}`,
        lastModified: post.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // DB not available at build time — skip dynamic pages
  }

  try {
    const users = await prisma.user.findMany({
      where: {},
      select: { userName: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    });

    for (const user of users) {
      dynamicPages.push({
        url: `${baseUrl}/profile/${user.userName}`,
        lastModified: user.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // DB not available — skip
  }

  return [...staticPages, ...dynamicPages];
}
