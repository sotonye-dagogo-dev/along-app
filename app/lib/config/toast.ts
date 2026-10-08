/**
 * Toast timing configuration (config-driven, zero app deps).
 * Single source of truth for how long each toast variant stays on screen.
 * GlobalUndoToast's progress bar and auto-close timer both derive from the
 * same duration so the bar fully elapses before the toast vanishes.
 */
export interface ToastConfig {
  successMs: number;
  errorMs: number;
  infoMs: number;
  undoMs: number;
}

export const TOAST_CONFIG: ToastConfig = {
  successMs: 3000,
  errorMs: 5000,
  infoMs: 3000,
  undoMs: 10000,
};
