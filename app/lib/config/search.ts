/**
 * Loose search registry — single source of truth for how user queries are
 * tokenized, recalled, and relevance-ranked.
 *
 * Philosophy (Spotify-style): a query like "Lekki to Ajah" must match a post
 * titled "Ajah from Lekki", tolerate typos ("Leki" → "Lekki"), and consider
 * locations + stop names + descriptions + titles + tags — while exact,
 * high-quality matches still rank first.
 *
 * Pipeline (see searchService):
 *  1. `tokenizeSearchQuery` splits the query into significant terms
 *     (lowercased, punctuation-stripped, stopwords + sub-min-length dropped).
 *  2. Recall ORs every term across title/description/region/tags (+ a
 *     head-prefix clause per long term so single-typo queries still recall,
 *     + bounded routes-JSON stop-name ids) — broad on purpose.
 *  3. `scoreTextRelevance` ranks the recalled set in memory (deterministic):
 *     whole-phrase hit > per-term exact > per-term fuzzy (Levenshtein) >
 *     validity > recency. No rows are ever dropped by ranking alone.
 *
 * Queries that tokenize to nothing (e.g. "A to B" with single-letter stops)
 * fall back to whole-phrase recall — the legacy exact behaviour.
 */
export const SEARCH_CONFIG = {
  /**
   * Connector/filler words that carry no search meaning. "Lekki to Ajah"
   * searches Lekki + Ajah regardless of the "to" (or "from", any order).
   */
  stopwords: [
    "a", "an", "the",
    "to", "from", "of", "for", "in", "on", "at", "by", "with",
    "and", "or", "is", "it", "as",
  ] as string[],
  /** Terms shorter than this are dropped (a bare "a" would match everything). */
  minTermLength: 2,
  /** Max terms taken from a query (head-wins, keeps recall bounded). */
  maxTerms: 6,
  /** Terms at least this long also recall on their head-prefix (typo recall). */
  typoRecallMinLength: 4,
  /**
   * Head-prefix length for typo recall: first max(2, len-2) chars.
   * Preserved heads catch deletions/substitutions/insertions ("Leki"→"Lek…").
   */
  typoRecallPrefix: (term: string): string => {
    const len = term.length;
    if (len < 4) return term;
    return term.slice(0, Math.max(2, len - 2));
  },
  /** Max recalled candidates ranked in memory per search (deterministic cap). */
  candidateCap: 120,
  /** Bounded routes-JSON stop-name prefetch (per search, never throws). */
  stepNamePrefetchLimit: 25,
  /** Levenshtein ceiling per term↔word comparison (bounds the O(n·m) cost). */
  fuzzyMaxDistance: 2,
  /** Minimum similarity (1 - dist/maxLen) for a fuzzy term to count. */
  fuzzyMinSimilarity: 0.6,
  /**
   * Relevance weights — exact/high-quality matches always outrank loose ones:
   * whole-phrase ≫ all-terms-covered > per-term exact > per-term fuzzy.
   */
  rankWeights: {
    exactPhrase: 100,
    allTermsCovered: 25,
    termExact: 10,
    termFuzzyScale: 5,
  },
} as const;

export interface TokenizedQuery {
  /** Significant terms (lowercased, stopwords/short dropped, head-wins). */
  terms: string[];
  /** Lowercased whole-phrase (for exact-phrase boost + empty-terms fallback). */
  phrase: string;
}

/**
 * Pure query tokenizer. Never throws — garbage in yields empty terms (the
 * caller falls back to phrase recall), never an exception.
 */
export function tokenizeSearchQuery(raw: string): TokenizedQuery {
  try {
    const phrase = String(raw ?? "").trim().toLowerCase().slice(0, 100);
    const stop = new Set(SEARCH_CONFIG.stopwords);
    const terms = phrase
      .split(/[^a-z0-9]+/i)
      .map((t) => t.toLowerCase())
      .filter((t) => t.length >= SEARCH_CONFIG.minTermLength && !stop.has(t))
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, SEARCH_CONFIG.maxTerms);
    return { terms, phrase };
  } catch {
    return { terms: [], phrase: "" };
  }
}

/**
 * Pure Levenshtein distance with early exit past `maxDistance`.
 * Never throws — failures resolve to maxDistance + 1 (no match).
 */
export function levenshteinDistance(a: string, b: string, maxDistance: number = SEARCH_CONFIG.fuzzyMaxDistance): number {
  try {
    const s = String(a ?? "");
    const t = String(b ?? "");
    if (s === t) return 0;
    if (Math.abs(s.length - t.length) > maxDistance) return maxDistance + 1;
    if (s.length === 0) return Math.min(t.length, maxDistance + 1);
    if (t.length === 0) return Math.min(s.length, maxDistance + 1);
    let prev: number[] = Array.from({ length: t.length + 1 }, (_, i) => i);
    for (let i = 1; i <= s.length; i++) {
      const curr: number[] = [i];
      let rowMin = i;
      for (let j = 1; j <= t.length; j++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        const v = Math.min(prev[j] as number + 1, (curr[j - 1] as number) + 1, (prev[j - 1] as number) + cost);
        curr.push(v);
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > maxDistance) return maxDistance + 1;
      prev = curr;
    }
    return prev[t.length] as number;
  } catch {
    return maxDistance + 1;
  }
}

export interface SearchTextBag {
  title?: unknown;
  description?: unknown;
  region?: unknown;
  tags?: unknown;
  /** Extra haystack words (e.g. per-step stop names) for fuzzy matching. */
  extraWords?: string[];
}

export interface TermCoverage {
  exact: boolean;
  fuzzySimilarity: number;
}

function bagWords(bag: SearchTextBag): { joined: string; words: string[] } {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v) parts.push(v.toLowerCase());
  };
  push(bag.title);
  push(bag.description);
  push(bag.region);
  if (Array.isArray(bag.tags)) {
    for (const t of bag.tags) push(t);
  }
  if (Array.isArray(bag.extraWords)) {
    for (const w of bag.extraWords) push(w);
  }
  const joined = parts.join(" ");
  const words = joined.split(/[^a-z0-9]+/i).map((w) => w.toLowerCase()).filter(Boolean);
  return { joined, words };
}

/**
 * Pure per-term coverage of a text bag: exact substring wins; otherwise the
 * best Levenshtein similarity across words (0 when below threshold).
 */
export function termCoverage(term: string, bag: SearchTextBag): TermCoverage {
  const needle = String(term ?? "").toLowerCase();
  if (!needle) return { exact: false, fuzzySimilarity: 0 };
  try {
    const { joined, words } = bagWords(bag);
    if (joined.includes(needle)) return { exact: true, fuzzySimilarity: 1 };
    let best = 0;
    for (const w of words) {
      // Length pre-filter: pairs differing by more than the distance ceiling
      // can never match — skips the O(n·m) comparison cheaply.
      if (Math.abs(w.length - needle.length) > SEARCH_CONFIG.fuzzyMaxDistance) continue;
      const dist = levenshteinDistance(needle, w);
      if (dist > SEARCH_CONFIG.fuzzyMaxDistance) continue;
      const sim = 1 - dist / Math.max(needle.length, w.length);
      if (sim >= SEARCH_CONFIG.fuzzyMinSimilarity && sim > best) best = sim;
    }
    return { exact: false, fuzzySimilarity: best };
  } catch {
    return { exact: false, fuzzySimilarity: 0 };
  }
}

export interface RelevanceScore {
  total: number;
  phraseHit: boolean;
  coveredTerms: number;
  exactTerms: number;
}

/**
 * Pure deterministic relevance score for one candidate. Higher = better;
 * ties are broken by the caller (validity → recency → id). Never throws.
 */
export function scoreTextRelevance(bag: SearchTextBag, query: TokenizedQuery): RelevanceScore {
  const fallback: RelevanceScore = { total: 0, phraseHit: false, coveredTerms: 0, exactTerms: 0 };
  try {
    const { joined } = bagWords(bag);
    const w = SEARCH_CONFIG.rankWeights;
    let total = 0;
    let covered = 0;
    let exact = 0;
    const phraseHit = query.phrase.length >= 2 && joined.includes(query.phrase);
    if (phraseHit) total += w.exactPhrase;
    for (const term of query.terms) {
      const cov = termCoverage(term, bag);
      if (cov.exact) {
        total += w.termExact;
        covered += 1;
        exact += 1;
      } else if (cov.fuzzySimilarity > 0) {
        total += cov.fuzzySimilarity * w.termFuzzyScale;
        covered += 1;
      }
    }
    if (query.terms.length > 0 && covered === query.terms.length) {
      total += w.allTermsCovered;
    }
    return { total, phraseHit, coveredTerms: covered, exactTerms: exact };
  } catch {
    return fallback;
  }
}

/**
 * Zero-result query analytics registry — tunes stopwords/fuzzy thresholds
 * over time. When a first-page search returns no posts/users/tags, the
 * service logs one `AnalyticsEvent` (`search_zero_results`) with the
 * normalized query + tokenized terms + active filters. The admin analytics
 * endpoint aggregates the top queries so stopwords/fuzzy knobs can be tuned
 * from evidence, not guesses. Config-driven, additive, never throws.
 */
export const SEARCH_ANALYTICS_CONFIG = {
  /** AnalyticsEvent.eventName for zero-result searches. */
  eventName: "search_zero_results",
  /** Queries are normalized (lowercase/trim) + capped before storage. */
  maxQueryLength: 100,
  /** Top-N zero-result queries surfaced on the admin analytics page. */
  topQueriesLimit: 20,
  /** Copy for the admin analytics section (config-owned, no hardcoding). */
  sectionTitle: "Zero-result queries",
  sectionDescription:
    "Queries that returned nothing — tune stopwords / fuzzy thresholds from these.",
  emptyLabel: "No zero-result queries in this period.",
} as const;

export type SearchAnalyticsConfig = typeof SEARCH_ANALYTICS_CONFIG;

export interface ZeroResultQueryFilters {
  type?: string;
  region?: string;
  postType?: string;
}

/**
 * Normalize a raw query for analytics storage (lowercase, trim, capped).
 * Pure, never throws — garbage yields "" (the caller skips empty).
 */
export function normalizeAnalyticsQuery(raw: unknown): string {
  try {
    return String(raw ?? "")
      .trim()
      .toLowerCase()
      .slice(0, SEARCH_ANALYTICS_CONFIG.maxQueryLength);
  } catch {
    return "";
  }
}

/**
 * Build the AnalyticsEvent payload for a zero-result search. Pure, never
 * throws — always returns a JSON-safe object (possibly with empty fields).
 */
export function buildZeroResultPayload(
  rawQuery: unknown,
  tokenized: TokenizedQuery | null | undefined,
  filters?: ZeroResultQueryFilters | null,
): Record<string, unknown> {
  try {
    const query = normalizeAnalyticsQuery(rawQuery);
    const terms = Array.isArray(tokenized?.terms) ? [...tokenized.terms].slice(0, 6) : [];
    const phrase = typeof tokenized?.phrase === "string" ? tokenized.phrase.slice(0, 100) : "";
    return {
      query,
      terms,
      phrase,
      type: filters?.type ?? null,
      region: filters?.region ?? null,
      postType: filters?.postType ?? null,
    };
  } catch {
    return { query: "", terms: [], phrase: "" };
  }
}
