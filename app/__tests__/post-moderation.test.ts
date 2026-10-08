import { POST_ACTIONS_CONFIG, MODERATION_CONFIG, NOTIFICATION_REGISTRY } from "@/app/lib/config";
import { isAdminRole } from "@/app/lib/services/postModerationService";

describe("post moderation config (metadata-driven)", () => {
  it("exposes owner/admin management labels", () => {
    expect(POST_ACTIONS_CONFIG.editLabel).toBeTruthy();
    expect(POST_ACTIONS_CONFIG.deleteLabel).toBeTruthy();
    expect(POST_ACTIONS_CONFIG.archiveLabel).toBeTruthy();
    expect(POST_ACTIONS_CONFIG.unarchiveLabel).toBeTruthy();
    expect(POST_ACTIONS_CONFIG.deleteTitle).toBeTruthy();
    expect(POST_ACTIONS_CONFIG.archiveTitle).toBeTruthy();
    expect(POST_ACTIONS_CONFIG.commentDeleteTitle).toBeTruthy();
  });

  it("keeps report reasons metadata-driven", () => {
    expect(POST_ACTIONS_CONFIG.reportReasons.length).toBeGreaterThan(0);
    expect(POST_ACTIONS_CONFIG.reportReasons.every((r) => r.value && r.label)).toBe(true);
  });

  it("defines the admin moderation actions", () => {
    const values = MODERATION_CONFIG.adminActions.map((a) => a.value);
    expect(values).toEqual(["DISMISS", "ARCHIVE_POST", "REMOVE_POST"]);
    expect(MODERATION_CONFIG.adminActions.every((a) => a.label && a.description)).toBe(true);
  });

  it("hides map, navigation, trust and fare for route requests", () => {
    expect(MODERATION_CONFIG.routeRequestHides.map).toBe(true);
    expect(MODERATION_CONFIG.routeRequestHides.navigationGuide).toBe(true);
    expect(MODERATION_CONFIG.routeRequestHides.trustScore).toBe(true);
    expect(MODERATION_CONFIG.routeRequestHides.fare).toBe(true);
  });

  it("registers report-lifecycle notification types", () => {
    expect(NOTIFICATION_REGISTRY.REPORT).toBeDefined();
    expect(NOTIFICATION_REGISTRY.MODERATION).toBeDefined();
  });

  it("recognises admin roles", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("MODERATOR")).toBe(true);
    expect(isAdminRole("USER")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});
