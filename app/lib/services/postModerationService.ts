/**
 * Post/comment moderation client flows (config-driven, thin UI glue).
 * Every destructive action goes through the global confirm modal
 * (modalService) and offers the global undo toast (toastService + undoService).
 * ACID is enforced server-side (single transactions); undo replays the
 * pre-delete snapshot as a single POST so a torn client state never leaves
 * a half-restored post.
 */
"use client";

import { POST_ACTIONS_CONFIG, MODERATION_CONFIG } from "@/app/lib/config";
import { modalService } from "./modalService";
import { toastService } from "./toastService";
import { undoService } from "./undoService";

export function isAdminRole(role?: string | null): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}

export interface PostSnapshot {
  id: string;
  title: string;
  description?: string | null;
  type?: "ROUTE" | "ROUTE_REQUEST" | "ROUTE_RESPONSE";
  quotedPostId?: string | null;
  routes: unknown;
  images: string[];
  tags: string[];
  region?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  waypoints?: { lat: number; lng: number }[] | null;
  totalDistanceKm?: number | null;
  estimatedMins?: number | null;
}

function snapshotBody(snapshot: PostSnapshot): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: snapshot.title,
    routes: snapshot.routes,
    images: snapshot.images ?? [],
    tags: snapshot.tags ?? [],
  };
  if (snapshot.description) body.description = snapshot.description;
  if (snapshot.type && snapshot.type !== "ROUTE") body.type = snapshot.type;
  if (snapshot.quotedPostId) body.quotedPostId = snapshot.quotedPostId;
  if (snapshot.region) body.region = snapshot.region;
  if (typeof snapshot.startLat === "number") body.startLat = snapshot.startLat;
  if (typeof snapshot.startLng === "number") body.startLng = snapshot.startLng;
  if (typeof snapshot.endLat === "number") body.endLat = snapshot.endLat;
  if (typeof snapshot.endLng === "number") body.endLng = snapshot.endLng;
  if (snapshot.waypoints) body.waypoints = snapshot.waypoints;
  if (typeof snapshot.totalDistanceKm === "number") body.totalDistanceKm = snapshot.totalDistanceKm;
  if (typeof snapshot.estimatedMins === "number") body.estimatedMins = snapshot.estimatedMins;
  return body;
}

export interface DeletePostOptions {
  postId: string;
  snapshot: PostSnapshot;
  isAdmin?: boolean;
  adminEndpoint?: boolean;
  onDeleted?: (postId: string) => void;
  onRestored?: (postId: string, newPostId: string) => void;
}

/** Global-confirm -> DELETE -> global-undo (restore replays the snapshot). */
export function deletePostWithConfirm(options: DeletePostOptions): void {
  const { postId, snapshot, isAdmin, adminEndpoint, onDeleted, onRestored } = options;
  modalService.confirm({
    title: isAdmin ? POST_ACTIONS_CONFIG.adminDeleteTitle : POST_ACTIONS_CONFIG.deleteTitle,
    description: isAdmin
      ? POST_ACTIONS_CONFIG.adminDeleteDescription
      : POST_ACTIONS_CONFIG.deleteDescription,
    variant: "destructive",
    onConfirm: () => {
      modalService.close();
      void (async () => {
        try {
          const res = await fetch(
            adminEndpoint ? "/api/admin/posts" : `/api/posts/${postId}`,
            adminEndpoint
              ? { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId }) }
              : { method: "DELETE" }
          );
          if (!res.ok) throw new Error("delete failed");
          onDeleted?.(postId);
          const undoId = `post-delete:${postId}:${Date.now()}`;
          undoService.register({
            id: undoId,
            label: "Undo post deletion",
            onUndo: () => {
              void (async () => {
                try {
                  const restore = await fetch("/api/posts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(snapshotBody(snapshot)),
                  });
                  if (!restore.ok) throw new Error("restore failed");
                  const data = await restore.json().catch(() => null);
                  onRestored?.(postId, (data?.post?.id as string | undefined) ?? postId);
                  toastService.success(POST_ACTIONS_CONFIG.restoreSuccess);
                } catch {
                  toastService.error(POST_ACTIONS_CONFIG.deleteError);
                }
              })();
            },
          });
          toastService.undo({
            message: POST_ACTIONS_CONFIG.deleteUndoMessage,
            undoLabel: POST_ACTIONS_CONFIG.deleteUndoLabel,
            onUndo: () => undoService.execute(undoId),
          });
        } catch {
          toastService.error(POST_ACTIONS_CONFIG.deleteError);
        }
      })();
    },
  });
}

export interface ArchivePostOptions {
  postId: string;
  archived: boolean;
  isAdmin?: boolean;
  adminEndpoint?: boolean;
  onChanged?: (postId: string, archived: boolean) => void;
}

/** Global-confirm -> PATCH isArchived -> global-undo (unarchive replays). */
export function archivePostWithConfirm(options: ArchivePostOptions): void {
  const { postId, archived, isAdmin, adminEndpoint, onChanged } = options;
  const archiving = !archived;
  modalService.confirm({
    title: archiving ? POST_ACTIONS_CONFIG.archiveTitle : POST_ACTIONS_CONFIG.unarchiveTitle,
    description: archiving
      ? POST_ACTIONS_CONFIG.archiveDescription
      : POST_ACTIONS_CONFIG.unarchiveDescription,
    variant: archiving ? "sensitive" : "sensitive",
    onConfirm: () => {
      modalService.close();
      void (async () => {
        const apply = async (value: boolean): Promise<boolean> => {
          const res = await fetch(
            adminEndpoint ? "/api/admin/posts" : `/api/posts/${postId}`,
            adminEndpoint
              ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, isArchived: value }) }
              : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isArchived: value }) }
          );
          return res.ok;
        };
        const ok = await apply(archiving);
        if (!ok) {
          toastService.error(archiving ? POST_ACTIONS_CONFIG.archiveError : POST_ACTIONS_CONFIG.unarchiveError);
          return;
        }
        onChanged?.(postId, archiving);
        if (isAdmin) {
          toastService.success(archiving ? POST_ACTIONS_CONFIG.archiveSuccess : POST_ACTIONS_CONFIG.unarchiveSuccess);
          return;
        }
        if (archiving) {
          const undoId = `post-archive:${postId}:${Date.now()}`;
          undoService.register({
            id: undoId,
            label: "Undo archive",
            onUndo: () => {
              void (async () => {
                const restored = await apply(false);
                if (restored) {
                  onChanged?.(postId, false);
                  toastService.success(POST_ACTIONS_CONFIG.unarchiveSuccess);
                } else {
                  toastService.error(POST_ACTIONS_CONFIG.unarchiveError);
                }
              })();
            },
          });
          toastService.undo({
            message: POST_ACTIONS_CONFIG.archiveUndoMessage,
            undoLabel: POST_ACTIONS_CONFIG.deleteUndoLabel,
            onUndo: () => undoService.execute(undoId),
          });
        } else {
          toastService.success(POST_ACTIONS_CONFIG.unarchiveSuccess);
        }
      })();
    },
  });
}

export interface DeleteCommentOptions {
  postId: string;
  commentId: string;
  commentText: string;
  onDeleted?: (commentId: string) => void;
  onRestored?: (commentId: string) => void;
}

/** Global-confirm -> DELETE comment -> global-undo (re-posts the text). */
export function deleteCommentWithConfirm(options: DeleteCommentOptions): void {
  const { postId, commentId, commentText, onDeleted, onRestored } = options;
  modalService.confirm({
    title: POST_ACTIONS_CONFIG.commentDeleteTitle,
    description: POST_ACTIONS_CONFIG.commentDeleteDescription,
    variant: "destructive",
    onConfirm: () => {
      modalService.close();
      void (async () => {
        try {
          const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
          if (!res.ok) throw new Error("delete failed");
          onDeleted?.(commentId);
          const undoId = `comment-delete:${commentId}:${Date.now()}`;
          undoService.register({
            id: undoId,
            label: "Undo comment deletion",
            onUndo: () => {
              void (async () => {
                try {
                  const restore = await fetch(`/api/posts/${postId}/comments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: commentText }),
                  });
                  if (!restore.ok) throw new Error("restore failed");
                  onRestored?.(commentId);
                  toastService.success(POST_ACTIONS_CONFIG.restoreSuccess);
                } catch {
                  toastService.error(POST_ACTIONS_CONFIG.commentDeleteError);
                }
              })();
            },
          });
          toastService.undo({
            message: POST_ACTIONS_CONFIG.commentDeleteSuccess,
            undoLabel: POST_ACTIONS_CONFIG.deleteUndoLabel,
            onUndo: () => undoService.execute(undoId),
          });
        } catch {
          toastService.error(POST_ACTIONS_CONFIG.commentDeleteError);
        }
      })();
    },
  });
}

export { MODERATION_CONFIG };
