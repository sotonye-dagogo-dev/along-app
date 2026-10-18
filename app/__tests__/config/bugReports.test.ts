/**
 * Bug-report lifecycle copy + action-modal config parity. The modal now
 * PREFILLS the note with the status default (admin sees what the reporter
 * gets); clearing the box still falls back to the default server-side.
 */
import {
  BUG_REPORT_STATUS_COPY,
  BUG_REPORT_ACTION_MODAL,
} from "@/app/lib/config/bugReports";

describe("BUG_REPORT_STATUS_COPY", () => {
  it("has non-empty copy for every email-triggering status plus DEFAULT", () => {
    for (const status of ["IN_PROGRESS", "RESOLVED", "CLOSED", "DEFAULT"]) {
      expect(BUG_REPORT_STATUS_COPY[status]).toBeTruthy();
      expect(BUG_REPORT_STATUS_COPY[status].length).toBeGreaterThan(10);
    }
  });
});

describe("BUG_REPORT_ACTION_MODAL", () => {
  it("declares the prefill + context + identification copy", () => {
    expect(BUG_REPORT_ACTION_MODAL.noteLabel).toMatch(/prefilled/i);
    expect(BUG_REPORT_ACTION_MODAL.resetDefaultLabel.length).toBeGreaterThan(0);
    expect(BUG_REPORT_ACTION_MODAL.contextLabel).toBeTruthy();
    expect(BUG_REPORT_ACTION_MODAL.contextShowLabel).toBeTruthy();
    expect(BUG_REPORT_ACTION_MODAL.contextHideLabel).toBeTruthy();
    expect(BUG_REPORT_ACTION_MODAL.reportedByLabel).toBeTruthy();
    expect(BUG_REPORT_ACTION_MODAL.assignedToLabel).toBeTruthy();
    expect(BUG_REPORT_ACTION_MODAL.metaSourceLabel).toBeTruthy();
    expect(BUG_REPORT_ACTION_MODAL.metaPathLabel).toBeTruthy();
    expect(BUG_REPORT_ACTION_MODAL.metaDigestLabel).toBeTruthy();
  });

  it("resolves a default note label for any status string", () => {
    const label = BUG_REPORT_ACTION_MODAL.useDefaultLabel("IN_PROGRESS");
    expect(label).toContain("IN PROGRESS");
    expect(label.length).toBeGreaterThan(0);
  });

  it("keeps the note cap sane (email layout + API limits)", () => {
    expect(BUG_REPORT_ACTION_MODAL.noteMaxLength).toBeGreaterThan(0);
    expect(BUG_REPORT_ACTION_MODAL.noteMaxLength).toBeLessThanOrEqual(1000);
  });
});
