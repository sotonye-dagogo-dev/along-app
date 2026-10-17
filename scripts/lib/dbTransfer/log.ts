/**
 * Operator feedback for transfer runs.
 *
 * Everything a run prints goes through here so that:
 *  - output is staged and time-stamped (long loads stay readable),
 *  - table-level and percentage progress is consistent across scripts,
 *  - connection strings are redacted before they can reach a terminal,
 *    a log file, or CI output.
 *
 * The copy itself lives in `DB_TRANSFER_CONFIG.copy`; this module only
 * renders it.
 */

import { DB_TRANSFER_CONFIG } from "../../../app/lib/config/dbTransfer";

const copy = DB_TRANSFER_CONFIG.copy;

export interface TransferLogOptions {
  /** Suppress per-row progress lines (still prints stage banners). */
  quiet?: boolean;
  /** Injected for deterministic output in tests. */
  now?: () => number;
  write?: (line: string) => void;
  writeError?: (line: string) => void;
}

export class TransferLog {
  private readonly quiet: boolean;
  private readonly now: () => number;
  private readonly write: (line: string) => void;
  private readonly writeError: (line: string) => void;

  private stepIndex = 0;
  private stepTotal = 0;
  private stepStartedAt = 0;
  private lastProgressAt = 0;

  constructor(options: TransferLogOptions = {}) {
    this.quiet = options.quiet ?? false;
    this.now = options.now ?? (() => Date.now());
    this.write = options.write ?? ((line) => console.log(line));
    this.writeError = options.writeError ?? ((line) => console.error(line));
  }

  banner(title: string): void {
    this.stepIndex = 0;
    this.write("");
    this.write(copy.banner(title));
  }

  /** Opens a numbered phase; `total` phases are known up front. */
  begin(total: number): void {
    this.stepTotal = total;
  }

  step(label: string): void {
    this.stepIndex += 1;
    this.stepStartedAt = this.now();
    this.write(copy.step(this.stepIndex, this.stepTotal || this.stepIndex, label));
  }

  /** Closes the current phase with its duration (defaults to time since `step`). */
  done(label?: string, ms?: number): void {
    const elapsed = ms ?? this.now() - this.stepStartedAt;
    this.write(copy.done(label ?? "done", elapsed));
  }

  info(message: string): void {
    this.write(copy.info(message));
  }

  ok(message: string): void {
    this.write(copy.info(`✔ ${message}`));
  }

  warn(message: string): void {
    this.write(copy.warn(message));
  }

  error(message: string): void {
    this.writeError(copy.fail(message));
  }

  table(name: string, rows: number | string): void {
    this.write(copy.tableRow(name, rows));
  }

  /** Raw line (already-redacted caller content). */
  line(value = ""): void {
    this.write(value);
  }

  /**
   * Percentage/progress line. Throttled so a tight insert loop does not
   * flood the terminal, but always emits the final 100%.
   */
  progress(label: string, done: number, total: number, throttleMs = 250): void {
    if (this.quiet) return;
    const at = this.now();
    const isFinal = done >= total;
    if (!isFinal && at - this.lastProgressAt < throttleMs) return;
    this.lastProgressAt = at;
    // Progress replaces its own line via a carriage return when possible.
    process.stdout.write(`\r${copy.progress(label, done, total)}`);
    if (isFinal) process.stdout.write("\n");
  }

  /** Clears a possibly-partial progress line before printing something else. */
  clearProgress(): void {
    if (this.quiet) return;
    process.stdout.write("\r" + " ".repeat(79) + "\r");
  }

  elapsedMs(since: number): number {
    return this.now() - since;
  }
}

/** Shared default logger for scripts that do not need injection. */
export function createLog(options: TransferLogOptions = {}): TransferLog {
  return new TransferLog(options);
}
