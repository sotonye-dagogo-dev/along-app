/**
 * Studio layout registry — single source of truth for admin Studio
 * editor/preview pane geometry.
 *
 * Problem (directive): on large screens the editor column grows tall while
 * the preview pane stays short at the top. The user scrolls the page to
 * reach the editor bottom and the preview scrolls out of view, so they must
 * scroll back up to inspect the preview. Same shape in the avatar editor.
 *
 * Fix (config-driven, non-breaking): generous viewport-relative preview
 * heights with independent overflow + sticky positioning so the preview
 * stays in view while the editor scrolls. Components consume `style`
 * (viewport math Tailwind cannot express) + `stickyClass` (pure Tailwind).
 * Pure constants + tiny style builders — never throws.
 */

import type { CSSProperties } from "react";

export const STUDIO_LAYOUT_CONFIG = {
  /**
   * Sticky wrapper for preview panes on desktop. `self-start` is required —
   * without it the grid stretches the sticky child to row height and stick
   * never engages. `items-start` must accompany it on the grid parent.
   */
  previewStickyClass: "lg:sticky lg:top-4 self-start",
  /** Right-column wrapper when preview + composer share a column (Email). */
  previewColumnStickyClass: "lg:sticky lg:top-4 self-start",
  /** Generous scrollable preview heights (viewport-relative, capped). */
  emailPreviewMaxHeight: "min(78vh, 880px)",
  emailPreviewMinHeight: 360,
  blogPreviewMaxHeight: "min(78vh, 900px)",
  blogPreviewMinHeight: 360,
  /** Avatar style-picker grid: tall enough to browse without page scroll. */
  avatarGridMaxHeight: "min(58vh, 480px)",
  avatarPreviewStickyClass: "sm:sticky sm:top-0 self-start",
} as const;

export type StudioLayoutConfig = typeof STUDIO_LAYOUT_CONFIG;

/** Style object for a scrollable preview pane (generous, viewport-capped). */
export function studioPreviewStyle(
  maxHeight: string = STUDIO_LAYOUT_CONFIG.blogPreviewMaxHeight,
  minHeight: number = STUDIO_LAYOUT_CONFIG.blogPreviewMinHeight,
): CSSProperties {
  try {
    return {
      maxHeight,
      minHeight,
      overflow: "auto",
    };
  } catch {
    return { maxHeight: "78vh", overflow: "auto" };
  }
}

/** Style object for the avatar style-picker grid. */
export function avatarGridStyle(): CSSProperties {
  try {
    return {
      maxHeight: STUDIO_LAYOUT_CONFIG.avatarGridMaxHeight,
      overflowY: "auto",
    };
  } catch {
    return { maxHeight: 480, overflowY: "auto" };
  }
}
