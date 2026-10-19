/**
 * Notification deep-routing (Sprint 80 / issue #25):
 * - an ASSIGNED admin's REPORT/MODERATION notification with metadata.bugId
 *   deep-links to the exact queue entry (/admin/bugs?highlight=), even when
 *   the report also links a post,
 * - reporter-facing rows (no bugId) keep their existing destinations,
 * - legacy rows (no metadata) resolve exactly as before,
 * - push payload URLs route through the same resolver (in-app click and
 *   notificationclick land in the same place).
 */
import { resolveNotificationRoute } from "@/app/lib/config/notificationRoutes";
import { resolvePushPayload } from "@/app/lib/config/pwa";

describe("resolveNotificationRoute: assignment deep-link (bugId)", () => {
  it("REPORT + bugId wins over the linked post", () => {
    expect(
      resolveNotificationRoute({
        type: "REPORT",
        postId: "post-1",
        metadata: { bugId: "bug-9" },
      }),
    ).toBe("/admin/bugs?highlight=bug-9");
  });

  it("REPORT + bugId without a post still lands on the queue entry", () => {
    expect(resolveNotificationRoute({ type: "REPORT", metadata: { bugId: "bug-9" } })).toBe(
      "/admin/bugs?highlight=bug-9",
    );
  });

  it("MODERATION + bugId deep-links too", () => {
    expect(
      resolveNotificationRoute({ type: "MODERATION", metadata: { bugId: "b7" } }),
    ).toBe("/admin/bugs?highlight=b7");
  });

  it("URL-encodes the id", () => {
    expect(
      resolveNotificationRoute({ type: "REPORT", metadata: { bugId: "id with space" } }),
    ).toBe("/admin/bugs?highlight=id%20with%20space");
  });

  it("ignores empty / non-string / null bugId (falls through)", () => {
    expect(resolveNotificationRoute({ type: "REPORT", metadata: { bugId: "" } })).toBe(
      "/notifications",
    );
    expect(resolveNotificationRoute({ type: "REPORT", metadata: { bugId: 42 } })).toBe(
      "/notifications",
    );
    expect(resolveNotificationRoute({ type: "REPORT", metadata: null })).toBe("/notifications");
  });
});

describe("resolveNotificationRoute: existing destinations unchanged", () => {
  it("reporter receipt (REPORT + post, NO bugId) opens the post — never /admin", () => {
    expect(resolveNotificationRoute({ type: "REPORT", postId: "p1" })).toBe("/posts/p1");
  });

  it("REPORT without post or bugId stays on /notifications (queue item, not a person)", () => {
    expect(resolveNotificationRoute({ type: "REPORT" })).toBe("/notifications");
  });

  it("MODERATION on a post opens the post", () => {
    expect(resolveNotificationRoute({ type: "MODERATION", postId: "p2" })).toBe("/posts/p2");
  });

  it("comment anchors still win for COMMENT/MENTION", () => {
    expect(
      resolveNotificationRoute({ type: "COMMENT", postId: "p3", commentId: "c4" }),
    ).toBe("/posts/p3?comment=c4");
    expect(
      resolveNotificationRoute({ type: "MENTION", postId: "p3", commentId: "c4" }),
    ).toBe("/posts/p3?comment=c4");
  });

  it("FOLLOW opens the actor profile; VERIFIED opens the security tab", () => {
    expect(resolveNotificationRoute({ type: "FOLLOW", actorUserName: "ada" })).toBe("/profile/ada");
    expect(resolveNotificationRoute({ type: "VERIFIED" })).toBe("/profile?tab=security");
  });

  it("unknown types fall back to /notifications (never a wrong profile)", () => {
    expect(resolveNotificationRoute({ type: "WHAT_IS_THIS" })).toBe("/notifications");
  });
});

describe("resolvePushPayload: same resolver as in-app clicks", () => {
  it("REPORT assignment push deep-links to the queue entry", () => {
    const p = resolvePushPayload("REPORT", "New UI report assigned to you: x", {
      metadata: { bugId: "bug-42" },
    });
    expect(p.url).toBe("/admin/bugs?highlight=bug-42");
    expect(p.title).toBe("Report update");
    expect(p.body).toBe("New UI report assigned to you: x");
  });

  it("reporter receipt push (REPORT + postId, no bugId) mirrors in-app: the post", () => {
    expect(resolvePushPayload("REPORT", "We received your report", { postId: "p1" }).url).toBe(
      "/posts/p1",
    );
  });

  it("post pushes still deep-link to the post", () => {
    expect(resolvePushPayload("LIKE", "Ada liked your post", { postId: "p1" }).url).toBe(
      "/posts/p1",
    );
  });

  it("favourite types without ids fall back to /notifications", () => {
    expect(resolvePushPayload("FUTURE_TYPE", "hello").url).toBe("/notifications");
  });
});
