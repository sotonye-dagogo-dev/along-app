/**
 * Dislike parity + comment-avatar tightening.
 * The vote table stores LIKE|DISLIKE in one row; every surface must carry the
 * viewer's dislike state so the feed card and the post-detail view agree, and
 * the dislike control must show an active fill/bg exactly like the like
 * control does. The comment composer must render the same AppAvatar (upload /
 * DiceBear config) as every other surface. Static level (no DB).
 */
import fs from "fs";
import path from "path";
import { POST_ACTIONS_CONFIG } from "@/app/lib/config/postActions";
import { PROFILE_POSTS_CONFIG } from "@/app/lib/config/profilePosts";

const ROOT = path.resolve(__dirname, "..", "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("dislike active styling (config-driven parity with like)", () => {
  it("declares like + dislike active/icon classes", () => {
    expect(POST_ACTIONS_CONFIG.likeActiveClass).toBeTruthy();
    expect(POST_ACTIONS_CONFIG.likeIconClass).toBeTruthy();
    expect(POST_ACTIONS_CONFIG.dislikeActiveClass).toBeTruthy();
    expect(POST_ACTIONS_CONFIG.dislikeIconClass).toBeTruthy();
  });

  it("dislike active styling uses design tokens (readable light + dark)", () => {
    expect(POST_ACTIONS_CONFIG.dislikeActiveClass).toContain("text-warning-text");
    expect(POST_ACTIONS_CONFIG.dislikeIconClass).toContain("fill-warning-text");
    expect(POST_ACTIONS_CONFIG.dislikeActiveClass).not.toContain("text-white");
  });

  it("PostCard reads both active styles from config (no hardcoded colors)", () => {
    const src = read("app/components/features/posts/PostCard.tsx");
    expect(src).toContain("POST_ACTIONS_CONFIG.likeActiveClass");
    expect(src).toContain("POST_ACTIONS_CONFIG.dislikeActiveClass");
    expect(src).toContain("POST_ACTIONS_CONFIG.dislikeIconClass");
    expect(src).toContain("aria-pressed={state.disliked}");
  });
});

describe("dislike state sync (feed card == detail view)", () => {
  it("PostCard seeds + resyncs disliked from the viewer flag", () => {
    const src = read("app/components/features/posts/PostCard.tsx");
    expect(src).toContain("_isDisliked?: boolean");
    expect(src).toContain("disliked: post._isDisliked ?? false");
    expect(src).toContain("disliked: action.payload._isDisliked ?? false");
    expect(src).toContain("post._isDisliked");
  });

  it("detail view wires the dislike button with optimistic count + rollback", () => {
    const src = read("app/(dashboard)/posts/[id]/page.tsx");
    expect(src).toContain("const handleDislike = async ()");
    expect(src).toContain("onClick={handleDislike}");
    expect(src).toContain("dislikesCount");
    expect(src).toContain("_isDisliked: newDisliked");
    expect(src).toContain("aria-pressed={disliked}");
  });

  it("detail like/dislike are mutually exclusive (switch clears the other)", () => {
    const src = read("app/(dashboard)/posts/[id]/page.tsx");
    expect(src).toContain("_isDisliked: newLiked ? false : wasDisliked");
    expect(src).toContain("_isLiked: newDisliked ? false : wasLiked");
  });

  it("detail sends toggle-safe vote types (repeat removes, never mis-adds)", () => {
    const src = read("app/(dashboard)/posts/[id]/page.tsx");
    expect(src).toContain('body: JSON.stringify({ type: "DISLIKE" })');
  });

  it("feed handlers use toggle-safe vote payloads", () => {
    const home = read("app/(dashboard)/home/page.tsx");
    expect(home).toContain('body: JSON.stringify({ type: "LIKE" })');
    expect(home).not.toContain('liked ? "LIKE" : "DISLIKE"');
    const card = read("app/components/features/profile/ProfilePostCard.tsx");
    expect(card).toContain("value: disliked");
  });

  it("shared interaction cache tracks dislikes with mutual exclusion", () => {
    const src = read("app/lib/streams/feedStream.ts");
    expect(src).toContain("_isDisliked?: boolean");
    expect(src).toContain("current._isDisliked = event.value");
    expect(src).toContain("current._isDisliked = false");
    expect(src).toContain("current._isLiked = false");
  });

  it("profile tabs forward the viewer dislike flag", () => {
    expect(PROFILE_POSTS_CONFIG.interactionFields).toContain("_isDisliked");
    const own = read("app/(dashboard)/profile/page.tsx");
    expect(own).toContain("_isDisliked");
    const other = read("app/(dashboard)/profile/[username]/page.tsx");
    expect(other).toContain("_isDisliked");
  });
});

describe("server dislike enrichment (viewer-scoped, never-throw)", () => {
  it("post detail returns _isDisliked from the vote row", () => {
    const src = read("app/api/posts/[id]/route.ts");
    expect(src).toContain('_isDisliked = like?.type === "DISLIKE"');
    expect(src).toContain("_isDisliked,");
  });

  it("post list enriches _isDisliked in batch", () => {
    const src = read("app/api/posts/route.ts");
    expect(src).toContain('type: "DISLIKE"');
    expect(src).toContain("_isDisliked: disliked.has(");
  });

  it("feed service enriches _isDisliked on scored + single-post paths", () => {
    const src = read("app/lib/services/feedService.ts");
    expect(src).toContain("_isDisliked?: boolean");
    expect(src).toContain("dislikedPostIds");
    expect(src).toContain('_isDisliked = like?.type === "DISLIKE"');
  });
});

describe("comment composer avatar (same AppAvatar as everywhere else)", () => {
  it("auth user carries the avatar config (API already selects it)", () => {
    const src = read("app/providers/AuthProvider.tsx");
    expect(src).toContain("avatarConfig?");
  });

  it("detail composer passes the viewer avatar config", () => {
    const src = read("app/(dashboard)/posts/[id]/page.tsx");
    expect(src).toContain("avatarConfig={currentUser?.avatarConfig ?? null}");
  });

  it("feed, search and profile comment viewers pass the avatar config", () => {
    const home = read("app/(dashboard)/home/page.tsx");
    expect(home).toContain("avatarConfig:");
    const search = read("app/(dashboard)/search/SearchPage.tsx");
    expect(search).toContain("avatarConfig:");
    const profile = read("app/components/features/profile/ProfilePostCard.tsx");
    expect(profile).toContain("avatarConfig:");
  });
});
