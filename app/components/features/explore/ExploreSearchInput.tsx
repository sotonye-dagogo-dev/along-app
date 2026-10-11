"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  EXPLORE_SEARCH_CONFIG,
  loadRecentSearches,
  saveRecentSearch,
  clearRecentSearches,
} from "@/app/lib/config/exploreSearch";
import { AppAvatar } from "@/app/components/ui";

interface SuggestionPost {
  id: string;
  title: string;
  type?: string;
  region?: string | null;
}

interface SuggestionUser {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
}

interface ExploreSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when a post suggestion is picked (explore centres + opens the pin). */
  onPickPost?: (postId: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  inputClassName?: string;
  autoSaveRecent?: boolean;
}

const DEFAULT_INPUT_CLASS =
  "w-full h-10 pl-9 pr-3 border border-border radius-sm text-sm font-sans outline-none bg-bg-base text-text-primary focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,98,59,0.12)] placeholder:text-text-muted";

/**
 * Explore search field with additive suggestions + recents.
 * The map's existing client-side filter keeps working untouched — typing
 * still flows through onChange; this only overlays a dropdown sourced from
 * /api/search (routes + general posts like requests + users + tags) and a
 * localStorage recent list. All failures are silent by design (offline or
 * rate-limited → plain filter input, zero behaviour change).
 */
export function ExploreSearchInput({
  value,
  onChange,
  onPickPost,
  placeholder = EXPLORE_SEARCH_CONFIG.placeholder,
  ariaLabel = EXPLORE_SEARCH_CONFIG.ariaLabel,
  inputClassName = DEFAULT_INPUT_CLASS,
  autoSaveRecent = true,
}: ExploreSearchInputProps) {
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [posts, setPosts] = useState<SuggestionPost[]>([]);
  const [users, setUsers] = useState<SuggestionUser[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Recents load on focus (fresh each open so cross-tab writes show up).
  useEffect(() => {
    if (focused) setRecents(loadRecentSearches());
  }, [focused ]);

  // Debounced suggestion fetch — additive only, never blocks the map filter.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < EXPLORE_SEARCH_CONFIG.minChars) {
      setPosts([]);
      setUsers([]);
      setTags([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      void (async () => {
        try {
          const res = await fetch(
            `/api/search?q=${encodeURIComponent(q)}&type=all&limit=10`,
            { signal: controller.signal, headers: { Accept: "application/json" } },
          );
          if (!res.ok) return;
          const data = (await res.json()) as {
            posts?: SuggestionPost[];
            users?: SuggestionUser[];
            tags?: { tag: string; count: number }[];
          };
          setPosts((data.posts ?? []).slice(0, EXPLORE_SEARCH_CONFIG.maxPosts));
          setUsers((data.users ?? []).slice(0, EXPLORE_SEARCH_CONFIG.maxUsers));
          setTags((data.tags ?? []).slice(0, EXPLORE_SEARCH_CONFIG.maxTags));
        } catch {
          // Offline / aborted / rate-limited — stay silent, filter still works.
        }
      })();
    }, EXPLORE_SEARCH_CONFIG.debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Close on outside tap (blur alone would kill suggestion clicks).
  useEffect(() => {
    if (!focused) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [focused]);

  const hasQuery = value.trim().length >= EXPLORE_SEARCH_CONFIG.minChars;
  const hasSuggestions = posts.length > 0 || users.length > 0 || tags.length > 0;
  const showDropdown = focused && (hasSuggestions || (!hasQuery && recents.length > 0));

  const commitTerm = (term: string) => {
    onChange(term);
    if (autoSaveRecent && term.trim()) setRecents(saveRecentSearch(term));
    setFocused(false);
  };

  const pickPost = (id: string, title: string) => {
    if (autoSaveRecent) setRecents(saveRecentSearch(title));
    setFocused(false);
    if (onPickPost) onPickPost(id);
    else router.push(`/posts/${id}`);
  };

  const pickUser = (userName: string) => {
    if (autoSaveRecent) setRecents(saveRecentSearch(userName));
    setFocused(false);
    router.push(`/profile/${userName}`);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setFocused(false);
          if (e.key === "Enter") commitTerm((e.target as HTMLInputElement).value);
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={showDropdown}
        role="combobox"
        aria-controls="explore-search-suggestions"
        autoComplete="off"
        className={inputClassName}
      />
      {showDropdown && (
        <div
          id="explore-search-suggestions"
          role="listbox"
          aria-label={EXPLORE_SEARCH_CONFIG.suggestionsAriaLabel}
          className="absolute top-full left-0 right-0 z-30 mt-1.5 bg-bg-card border border-border radius-md shadow-lg max-h-[320px] overflow-y-auto py-1.5"
        >
          {hasSuggestions ? (
            <>
              {posts.length > 0 && (
                <div>
                  <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {EXPLORE_SEARCH_CONFIG.routesGroupLabel}
                  </p>
                  {posts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickPost(p.id, p.title)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 border-none bg-transparent cursor-pointer hover:bg-bg-elevated"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-text-primary truncate">{p.title}</span>
                        {p.region && (
                          <span className="block text-[11px] text-text-muted truncate">{p.region}</span>
                        )}
                      </span>
                      {p.type && p.type !== "ROUTE" && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 radius-pill bg-warning text-warning-text shrink-0">
                          {EXPLORE_SEARCH_CONFIG.postTypeLabels[p.type] ?? p.type}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {users.length > 0 && (
                <div>
                  <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {EXPLORE_SEARCH_CONFIG.peopleGroupLabel}
                  </p>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => pickUser(u.userName)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 border-none bg-transparent cursor-pointer hover:bg-bg-elevated"
                    >
                      <AppAvatar src={u.avatar ?? undefined} alt={`${u.firstName} ${u.lastName}`} size={24} linkToProfile={false} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-text-primary truncate">
                          {u.firstName} {u.lastName}
                        </span>
                        <span className="block text-[11px] text-text-muted truncate">@{u.userName}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {tags.length > 0 && (
                <div>
                  <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {EXPLORE_SEARCH_CONFIG.tagsGroupLabel}
                  </p>
                  <div className="flex flex-wrap gap-1.5 px-3 pb-1.5">
                    {tags.map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => commitTerm(t.tag)}
                        className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary hover:border-primary-muted hover:text-primary transition-colors cursor-pointer"
                      >
                        #{t.tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between px-3 pt-1.5 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {EXPLORE_SEARCH_CONFIG.recentGroupLabel}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches();
                    setRecents([]);
                  }}
                  className="text-[11px] font-medium text-text-muted border-none bg-transparent cursor-pointer hover:text-primary"
                >
                  {EXPLORE_SEARCH_CONFIG.clearRecentLabel}
                </button>
              </div>
              {recents.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => commitTerm(r)}
                  className="w-full text-left px-3 py-2 text-sm text-text-secondary border-none bg-transparent cursor-pointer hover:bg-bg-elevated truncate"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {hasQuery && !hasSuggestions && (
            <p className="px-3 py-2 text-xs text-text-muted">{EXPLORE_SEARCH_CONFIG.emptySuggestionsLabel}</p>
          )}
          {/* Direct link to full search (non-intrusive footer, existing flows untouched). */}
          {hasQuery && (
            <Link
              href={`/search?q=${encodeURIComponent(value.trim())}`}
              className="block px-3 py-2 text-xs font-semibold text-primary no-underline hover:underline border-t border-border mt-1 pt-2"
            >
              See all results for “{value.trim().slice(0, 40)}” →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default ExploreSearchInput;
