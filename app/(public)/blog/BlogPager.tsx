"use client";

import { useRouter } from "next/navigation";
import { PageNavigator } from "@/app/components/ui/PageNavigator";

interface BlogPagerProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  category: string;
}

/**
 * Client pager for the (server-rendered) blog listing. Navigates via
 * ?page=&category= so links stay shareable/SEO-friendly; the numbered UI
 * comes from the shared PageNavigator (prev / specific / next).
 */
export function BlogPager({ page, totalPages, total, pageSize, category }: BlogPagerProps) {
  const router = useRouter();
  return (
    <PageNavigator
      page={page}
      totalPages={totalPages}
      total={total}
      pageSize={pageSize}
      onChange={(p) => {
        const params = new URLSearchParams();
        if (p > 1) params.set("page", String(p));
        if (category !== "all") params.set("category", category);
        const qs = params.toString();
        router.push(qs ? `/blog?${qs}` : "/blog");
      }}
    />
  );
}
