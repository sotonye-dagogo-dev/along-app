"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppModal } from "@/app/components/ui/AppModal";
import { ViewMoreButton } from "@/app/components/ui/ViewMoreButton";
import CommentInput from "./CommentInput";
import CommentList from "./CommentList";
import { COMMENTS_CONFIG } from "@/app/lib/config/comments";
import { POST_ACTIONS_CONFIG } from "@/app/lib/config/postActions";
import { toastService } from "@/app/lib/services/toastService";
import type { AvatarConfig } from "@/app/lib/types";

interface ModalComment {
  id: string;
  text: string;
  createdAt: string;
  user: {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    avatar?: string | null;
    avatarConfig?: unknown;
  };
}

interface ViewerInfo {
  userName: string;
  displayName: string;
  avatar?: string | null;
  avatarConfig?: AvatarConfig | null;
}

interface PostCommentsModalProps {
  open: boolean;
  postId: string | null;
  postTitle?: string;
  viewer: ViewerInfo;
  onClose: () => void;
  onCommentPosted?: (postId: string) => void;
}

/**
 * Shared comment modal — feed, profile tabs, and search all open the same
 * modal (composer + list + routing link to the full post view) instead of
 * navigating away. Non-breaking: callers that previously used window.location
 * or inline AppModal markup get identical behaviour through this wrapper.
 */
export function PostCommentsModal({
  open,
  postId,
  postTitle,
  viewer,
  onClose,
  onCommentPosted,
}: PostCommentsModalProps) {
  const [comments, setComments] = useState<ModalComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!open || !postId) return;
    let cancelled = false;
    setLoading(true);
    setNextCursor(null);
    void (async () => {
      try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setComments(data.comments ?? []);
          setNextCursor(data.nextCursor ?? null);
        }
      } catch {
        // Modal still renders with the expand-post fallback.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  /** Cursor "View more" — appends the next (older) comment window. */
  const loadMore = useCallback(async () => {
    if (!postId || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments?cursor=${encodeURIComponent(nextCursor)}`);
      if (!res.ok) throw new Error("view more failed");
      const data = await res.json();
      const incoming: ModalComment[] = Array.isArray(data.comments) ? data.comments : [];
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...incoming.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(data.nextCursor ?? null);
    } catch {
      // Silent — the button stays so the user can retry.
    } finally {
      setLoadingMore(false);
    }
  }, [postId, nextCursor, loadingMore]);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!postId) return;
      try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.comment) setComments((prev) => [data.comment, ...prev]);
          onCommentPosted?.(postId);
        } else {
          toastService.error(POST_ACTIONS_CONFIG.commentEditError);
        }
      } catch {
        toastService.error("Failed to post comment");
      }
    },
    [postId, onCommentPosted],
  );

  if (!postId) return null;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="default"
      title={COMMENTS_CONFIG.modalTitle}
      subtitle={postTitle}
    >
      <CommentInput
        userName={viewer.userName}
        displayName={viewer.displayName}
        avatar={viewer.avatar}
        avatarConfig={viewer.avatarConfig}
        onSubmit={handleSubmit}
      />
      {loading ? (
        <p className="text-sm text-text-muted py-4 text-center">{COMMENTS_CONFIG.modalLoadingLabel}</p>
      ) : (
        <>
          <CommentList
            comments={comments}
            postId={postId}
            onDeleted={(id) => setComments((prev) => prev.filter((c) => c.id !== id))}
            onUpdated={(c) => setComments((prev) => prev.map((p) => (p.id === c.id ? { ...p, text: c.text } : p)))}
          />
          {comments.length > 0 && (
            <ViewMoreButton
              onViewMore={() => void loadMore()}
              loading={loadingMore}
              shown={comments.length}
              total={null}
              hasMore={nextCursor !== null}
            />
          )}
        </>
      )}
      <div className="pt-3 mt-1 border-t border-border">
        <Link
          href={`/posts/${postId}`}
          className="text-sm font-semibold text-primary no-underline hover:underline"
        >
          {COMMENTS_CONFIG.modalExpandLabel}
        </Link>
      </div>
    </AppModal>
  );
}

export default PostCommentsModal;
