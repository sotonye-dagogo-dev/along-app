/**
 * Comments configuration (config-driven, zero app deps).
 * Single source of truth for the comment composer + list + modal so the
 * inline composer (post detail), the feed modal, and the profile modal all
 * render identical avatars, carets, and copy.
 *
 * Why this exists:
 * - The composer uses a transparent-textarea-over-highlight overlay for
 *   @mention styling. `caret-current` inherited the transparent text color,
 *   making the caret invisible — the only textbox platform-wide with that
 *   bug. The caret color below is explicit so it stays visible in both themes.
 * - Avatars were initials-only divs in comments while every other surface
 *   uses AppAvatar (DiceBear/upload image + fallback). Centralising the size
 *   + fallback keeps them consistent.
 */

export interface CommentsConfig {
  /** Composer textarea placeholder (mentions hint included). */
  composerPlaceholder: string;
  /** Aria label for the composer. */
  composerAriaLabel: string;
  /** Explicit caret color — must stay opaque in light + dark themes. */
  caretColor: string;
  /** Selection highlight inside the transparent textarea. */
  selectionClass: string;
  /** Avatar size (px) for composer, list rows, and mention dropdown. */
  avatarSize: 32;
  mentionAvatarSize: 24;
  /** Comment modal copy (shared feed/profile/search modal). */
  modalTitle: string;
  modalExpandLabel: string;
  modalLoadingLabel: string;
  /** Composer + edit limits. */
  maxLength: number;
  mentionMinChars: number;
  mentionDebounceMs: number;
}

export const COMMENTS_CONFIG: CommentsConfig = {
  composerPlaceholder: "Add a comment... (use @ to mention)",
  composerAriaLabel: "Add a comment",
  caretColor: "var(--color-primary)",
  selectionClass: "selection:bg-primary-muted",
  avatarSize: 32,
  mentionAvatarSize: 24,
  modalTitle: "Comments",
  modalExpandLabel: "Expand post to view full discussion →",
  modalLoadingLabel: "Loading comments…",
  maxLength: 1000,
  mentionMinChars: 1,
  mentionDebounceMs: 200,
};
