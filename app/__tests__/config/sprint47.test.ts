import { PWA_FAQ_LINKS } from "@/app/lib/config/pwa";
import {
  DELETED_USER_COPY,
  filterVisibleUsers,
  isArchivedUser,
  isDeletedUser,
  isVisibleUser,
  visibleUserWhere,
} from "@/app/lib/config/userVisibility";

describe("sprint47: PWA FAQ links", () => {
  it("routes all notice help affordances into the Offline & App FAQ section", () => {
    for (const href of Object.values(PWA_FAQ_LINKS)) {
      expect(href.startsWith("/faq?q=")).toBe(true);
      expect(href).toContain("#offline-pwa");
    }
  });

  it("targets the notifications query for push help", () => {
    expect(PWA_FAQ_LINKS.pushHelp).toContain("notifications");
  });

  it("keeps install/offline help distinct", () => {
    expect(PWA_FAQ_LINKS.installHelp).not.toBe(PWA_FAQ_LINKS.offlineHelp);
  });
});

describe("sprint47: user visibility", () => {
  it("flags deleted accounts", () => {
    expect(isDeletedUser({ isDeleted: true })).toBe(true);
    expect(isDeletedUser({ isDeleted: false })).toBe(false);
    expect(isDeletedUser(null)).toBe(false);
    expect(isDeletedUser(undefined)).toBe(false);
  });

  it("flags archived (pending-deletion) accounts, never deleted ones", () => {
    expect(isArchivedUser({ isDeleted: false, deletionScheduledFor: "2026-01-01" })).toBe(true);
    expect(isArchivedUser({ isDeleted: false, deletionScheduledFor: null })).toBe(false);
    expect(isArchivedUser({ isDeleted: true, deletionScheduledFor: "2026-01-01" })).toBe(false);
    expect(isArchivedUser(null)).toBe(false);
  });

  it("treats only live accounts as visible", () => {
    expect(isVisibleUser({ isDeleted: false, deletionScheduledFor: null })).toBe(true);
    expect(isVisibleUser({})).toBe(true);
    expect(isVisibleUser({ isDeleted: true })).toBe(false);
    expect(isVisibleUser({ isDeleted: false, deletionScheduledFor: new Date() })).toBe(false);
    expect(isVisibleUser(null)).toBe(false);
  });

  it("exposes a Prisma-safe visibility fragment", () => {
    expect(visibleUserWhere).toEqual({ isDeleted: false, deletionScheduledFor: null });
  });

  it("filters user arrays without mutating", () => {
    const users = [
      { id: "a", isDeleted: false, deletionScheduledFor: null },
      { id: "b", isDeleted: true, deletionScheduledFor: null },
      { id: "c", isDeleted: false, deletionScheduledFor: "2026-01-01" },
    ];
    const visible = filterVisibleUsers(users);
    expect(visible.map((u) => u.id)).toEqual(["a"]);
    expect(users).toHaveLength(3);
    expect(filterVisibleUsers(null)).toEqual([]);
    expect(filterVisibleUsers(undefined)).toEqual([]);
  });

  it("carries sanitized follow-unavailable copy", () => {
    expect(DELETED_USER_COPY.followUnavailable).toBeTruthy();
    expect(DELETED_USER_COPY.followUnavailableLabel).toBeTruthy();
    expect(DELETED_USER_COPY.followUnavailableTitle).toBeTruthy();
  });
});
