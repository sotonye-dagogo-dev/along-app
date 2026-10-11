/**
 * Comment tightening: caret visibility + avatar consistency + shared modal.
 * Static + unit level (no DB) so it runs in CI runners.
 */
import fs from "fs";
import path from "path";
import { COMMENTS_CONFIG } from "@/app/lib/config/comments";

const ROOT = path.resolve(__dirname, "..", "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("comment composer caret (invisible-caret bug)", () => {
  it("config pins an explicit opaque caret color (never currentColor/transparent)", () => {
    expect(COMMENTS_CONFIG.caretColor).toBeTruthy();
    expect(COMMENTS_CONFIG.caretColor).not.toMatch(/transparent|currentColor/i);
  });

  it("CommentInput applies the configured caret color inline (not caret-current)", () => {
    const src = read("app/components/features/comments/CommentInput.tsx");
    expect(src).toContain("caretColor");
    expect(src).toContain("COMMENTS_CONFIG.caretColor");
    expect(src).not.toContain("caret-current");
  });
});

describe("comment avatar consistency (AppAvatar everywhere)", () => {
  it("CommentList renders AppAvatar with the comment author's avatar/config", () => {
    const src = read("app/components/features/comments/CommentList.tsx");
    expect(src).toContain("AppAvatar");
    expect(src).toContain("comment.user.avatar");
    // No more initials-only avatar divs.
    expect(src).not.toContain("rounded-circle bg-bg-elevated flex items-center justify-center text-xs font-bold");
  });

  it("CommentInput renders AppAvatar (composer + mention rows)", () => {
    const src = read("app/components/features/comments/CommentInput.tsx");
    expect(src).toContain("AppAvatar");
    expect(src).not.toContain("rounded-circle bg-primary-muted flex items-center justify-center text-xs font-bold");
  });

  it("CommentInput accepts avatar/avatarConfig props (backward-compatible)", () => {
    const src = read("app/components/features/comments/CommentInput.tsx");
    expect(src).toContain("avatar?:");
    expect(src).toContain("avatarConfig?:");
  });
});

describe("shared comment modal (feed parity)", () => {
  it("PostCommentsModal exists and is config-driven", () => {
    const src = read("app/components/features/comments/PostCommentsModal.tsx");
    expect(src).toContain("COMMENTS_CONFIG.modalTitle");
    expect(src).toContain("COMMENTS_CONFIG.modalExpandLabel");
    expect(src).toContain(`/posts/`);
  });

  it("feed opens the modal instead of full-page navigating", () => {
    const home = read("app/(dashboard)/home/page.tsx");
    expect(home).toContain("PostCommentsModal");
    expect(home).toContain("openFeedComments");
    expect(home).not.toContain("window.location.href");
  });

  it("profile tabs reuse the shared modal", () => {
    const card = read("app/components/features/profile/ProfilePostCard.tsx");
    expect(card).toContain("PostCommentsModal");
  });

  it("fallback hook soft-navigates (no window.location.href reload)", () => {
    const hook = read("app/hooks/useFeedInteractions.ts");
    expect(hook).not.toContain("window.location.href");
    expect(hook).toContain("router.push");
  });
});
