import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://along.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/contact", "/privacy", "/terms", "/explore", "/faq", "/blog", "/posts/", "/profile/"],
        disallow: ["/admin", "/api", "/login", "/register", "/otp", "/home", "/bookmarks", "/notifications"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
