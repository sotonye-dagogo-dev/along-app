/**
 * Streaming sha256 helpers for the JSONL backup format.
 *
 * The file hash covers every line except the footer, each terminated by a
 * single `\n`. Because `JSON.stringify` never emits a raw newline, line
 * boundaries are unambiguous on both the write and read side, and the hash
 * can be computed without buffering the file.
 */

import { createHash, type Hash } from "node:crypto";

export interface LineHasher {
  /** Feed one line (WITHOUT its trailing newline). */
  update(line: string): void;
  /** Hex digest over everything fed so far. */
  digest(): string;
  /** Hex digest so far, without finalizing (used for progress reporting). */
  partial(): string;
}

export function createLineHasher(): LineHasher {
  const hash: Hash = createHash("sha256");
  const nl = Buffer.from("\n", "utf8");
  return {
    update(line: string): void {
      hash.update(line, "utf8");
      hash.update(nl);
    },
    digest(): string {
      return hash.digest("hex");
    },
    partial(): string {
      // `copy()` lets us inspect without consuming the stream.
      return hash.copy().digest("hex");
    },
  };
}

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
