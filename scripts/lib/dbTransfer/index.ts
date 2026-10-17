/**
 * Public surface of the DB-transfer library.
 *
 * Entry scripts (`scripts/db-*.ts`) import from here; everything else is
 * an implementation detail that may be reshuffled. Tests may reach deeper
 * to exercise individual pure modules.
 */

export * from "./types";
export * from "./checksum";
export * from "./codec";
export * from "./url";
export * from "./log";
export * from "./introspect";
export * from "./rows";
export * from "./dump";
export * from "./read";
export * from "./state";
export * from "./restore";
export * from "./verify";
export * from "./connection";
export * from "./cli";
export * from "./runbook";
export * from "./main";

// Re-exported so callers only need one import for the registry too.
export {
  DB_TRANSFER_CONFIG,
  DB_STAGES,
  backupFileName,
  backupId,
  fileSafeTimestamp,
  redactConnectionString,
  fingerprintConnection,
  describeConnection,
  evaluateResume,
  nextStage,
  isPlanComplete,
} from "../../../app/lib/config/dbTransfer";
export type {
  DbRole,
  DbEndpoint,
  DbStage,
  DbStagePlan,
  DbStageRecord,
  DbTransferJournal,
  DbTransferJournalEntry,
  ResumeDecision,
} from "../../../app/lib/config/dbTransfer";
