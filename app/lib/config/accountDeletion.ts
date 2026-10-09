/**
 * Account-deletion lifecycle config — all metadata-driven, no hardcoded
 * policy values in services/routes/components.
 */

export const ACCOUNT_DELETION_CONFIG = {
  /** Grace period between request and final anonymization (days). */
  gracePeriodDays: 7,
  /** Personal-info purge window stated in policy (days). */
  retentionDays: 30,
  /** Recovery window after final deletion via off-platform backups (days). */
  backupRecoveryDays: 30,
  /** Anonymized identity shown everywhere after completion. */
  deletedUserName: "deleted_user",
  deletedDisplayName: "Deleted User",
  deletedBio: "This account has been deleted.",
  /** Generic avatar seed for deleted profiles. */
  deletedAvatarSeed: "deleted-user",
  /** Cron guard: max requests finalized per run (safety backpressure). */
  maxFinalizePerRun: 50,
  /** Admin bulk deletion uses the same safe pipeline (archive → grace → wipe). */
  bulkUsesGracePeriod: true,
} as const;

export type AccountDeletionStatus = "PENDING" | "CANCELLED" | "COMPLETED";

export function deletionScheduledFor(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + ACCOUNT_DELETION_CONFIG.gracePeriodDays);
  return d;
}

export function buildDeletedUserName(idFragment: string): string {
  return `${ACCOUNT_DELETION_CONFIG.deletedUserName}_${String(idFragment).slice(0, 8)}`;
}

export function buildDeletedEmail(idFragment: string): string {
  return `deleted_${String(idFragment).slice(0, 8)}@deleted.local`;
}

export function isDeletionOverdue(scheduledFor: Date | string): boolean {
  return new Date(scheduledFor).getTime() <= Date.now();
}
