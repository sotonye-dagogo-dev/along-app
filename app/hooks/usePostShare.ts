"use client";

import { useCallback } from "react";
import { POST_ACTIONS_CONFIG } from "@/app/lib/config/postActions";
import { sharePostLink } from "@/app/lib/services/postShareService";
import { toastService } from "@/app/lib/services/toastService";

/**
 * usePostShare — shared share handler for every post surface.
 * Auth-gating stays with the caller (PostCard gates with "share routes";
 * full pages are already behind auth where needed). Toasts are
 * config-driven via POST_ACTIONS_CONFIG.
 */
export function usePostShare() {
  const sharePost = useCallback(async (postId: string, title?: string): Promise<boolean> => {
    const outcome = await sharePostLink(postId, title);
    if (outcome.ok) {
      // Native sheet already gave feedback — only toast for copy fallbacks.
      if (outcome.method !== "web-share") {
        toastService.success(POST_ACTIONS_CONFIG.copySuccess);
      }
      return true;
    }
    toastService.error(POST_ACTIONS_CONFIG.copyError);
    return false;
  }, []);

  return { sharePost };
}
