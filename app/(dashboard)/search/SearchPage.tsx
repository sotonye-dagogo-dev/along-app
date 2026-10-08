"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { PostCard } from "@/app/components/features/posts";
import { AppEmptyState, PostCardSkeleton } from "@/app/components/ui";
import { EMPTY_STATES } from "@/app/lib/config";
import { FollowButton } from "@/app/components/features/suggestions/FollowButton";

type Tab = "all" | "posts" | "users";

interface SearchUser {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
  verified: boolean;
  postCount?: number;
}

interface SearchPost {
  id: string;
  [key: string]: unknown;
}

interface SearchPayload {
  posts: SearchPost[];
  users: SearchUser[];
  tags: { tag: string; count: number }[];
  nextCursor: string | null;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "posts", label: "Routes" },
  { key: "users", label: "People" },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [input, setInput] = useState(initialQ);
  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<Tab>("all");
  const [data, setData] = useState<SearchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce typing → committed query (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(input.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  const runSearch = useCallback(async (q: string, t: Tab) => {
    abortRef.current?.abort();
    if (!q || q.length < 2) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&type=${t}&limit=10`,
        { signal: controller.signal, headers: { Accept: "application/json" } }
      );
      let payload: SearchPayload & { error?: string } | null = null;
      try {
        const text = await res.text();
        payload = text ? (JSON.parse(text) as SearchPayload & { error?: string }) : null;
      } catch {
        payload = null;
      }
      if (!res.ok) {
        setError(
          (payload as { error?: string } | null)?.error ??
            "Search is unavailable right now. Please try again."
        );
        setData(null);
        return;
      }
      setData({
        posts: payload?.posts ?? [],
        users: payload?.users ?? [],
        tags: payload?.tags ?? [],
        nextCursor: payload?.nextCursor ?? null,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("Network error. Please check your connection and try again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(query, tab);
  }, [query, tab, runSearch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const showPosts = tab !== "users";
  const showUsers = tab !== "posts";
  const empty =
    !loading &&
    !error &&
    data &&
    (tab === "posts"
      ? data.posts.length === 0
      : tab === "users"
        ? data.users.length === 0
        : data.posts.length === 0 && data.users.length === 0);

  return (
    <div className="flex justify-center">
      <div className="max-w-[640px] w-full px-4 py-4 flex flex-col gap-4">
        <div className="relative">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search routes, places, tags, people…"
            aria-label="Search routes and people"
            className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-bg-card text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-2" role="tablist" aria-label="Search categories">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`h-9 px-4 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                tab === t.key
                  ? "bg-primary text-white border-primary"
                  : "bg-bg-card text-text-secondary border-border hover:border-primary-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-border bg-bg-card px-4 py-3 text-sm text-text-secondary">
            {error}
          </div>
        )}

        {loading && !data && (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        )}

        {empty && <AppEmptyState {...EMPTY_STATES.search} />}

        {!query && !data && !loading && (
          <AppEmptyState
            {...EMPTY_STATES.search}
            title="Search Along"
            description="Find transport routes, places, tags and community members."
          />
        )}

        {data && showUsers && data.users.length > 0 && (
          <section aria-label="People" className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text-secondary">People</h2>
            {data.users.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-bg-card border border-border"
              >
                <Link href={`/profile/${u.userName}`} className="flex items-center gap-3 min-w-0 flex-1">
                  {u.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar} alt={u.userName} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-primary-muted text-primary flex items-center justify-center text-sm font-bold shrink-0">
                      {(u.userName?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {u.firstName} {u.lastName}
                    </div>
                    <div className="text-xs text-text-muted truncate">
                      @{u.userName}
                      {typeof u.postCount === "number" ? ` · ${u.postCount} posts` : ""}
                    </div>
                  </div>
                </Link>
                <FollowButton userId={u.id} />
              </div>
            ))}
          </section>
        )}

        {data && showPosts && data.posts.length > 0 && (
          <section aria-label="Routes" className="flex flex-col gap-3">
            {tab === "all" && <h2 className="text-sm font-semibold text-text-secondary">Routes</h2>}
            {data.posts.map((post) => (
              <PostCard key={post.id} post={post as never} />
            ))}
          </section>
        )}

        {data && tab === "all" && data.tags.length > 0 && (
          <section aria-label="Related tags" className="rounded-xl bg-bg-card border border-border px-4 py-3">
            <h2 className="text-sm font-semibold mb-2">Related tags</h2>
            <div className="flex flex-wrap gap-2">
              {data.tags.map((t) => (
                <button
                  key={t.tag}
                  onClick={() => setInput(`#${t.tag}`.replace(/^##/, "#"))}
                  className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary hover:border-primary-muted hover:text-primary transition-colors cursor-pointer"
                >
                  #{t.tag}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-[640px] mx-auto px-4 py-4"><PostCardSkeleton /><PostCardSkeleton /></div>}>
      <SearchContent />
    </Suspense>
  );
}
