"use client";

import { useEffect, useState, useCallback } from "react";
import { GlobalUndoToast } from "@/app/components/ui";
import { toastService } from "@/app/lib/services/toastService";
import { TOAST_CONFIG } from "@/app/lib/config/toast";
import type { ToastOptions } from "@/app/lib/services/toastService";

export function GlobalToastProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ToastOptions | null>(null);
  // Monotonic id so each new toast remounts GlobalUndoToast — restarting both
  // its auto-close timer and its progress-bar animation from zero.
  const [toastId, setToastId] = useState(0);

  const close = useCallback(() => {
    // NOTE: no toastService.close() re-emit here — close() already runs as the
    // listener(null) handler, so re-emitting would recurse infinitely.
    setOpen(false);
    setOptions(null);
  }, []);

  useEffect(() => {
    toastService.register((opts) => {
      if (opts) {
        // Single timer owner: GlobalUndoToast auto-closes after `duration`.
        // The provider intentionally sets no competing timeout so the
        // progress bar always fully elapses before the toast vanishes.
        setOptions({ duration: TOAST_CONFIG.undoMs, ...opts });
        setToastId((id) => id + 1);
        setOpen(true);
      } else {
        close();
      }
    });
    return () => {
      toastService.unregister();
    };
  }, [close]);

  return (
    <>
      {children}
      {options && (
        <GlobalUndoToast
          key={toastId}
          open={open}
          message={options.message}
          undoLabel={options.undoLabel}
          // Plain success/error/info toasts carry no undo action — only the
          // explicit `undo()` path renders the Undo button.
          onUndo={options.type === "undo" ? (options.onUndo || (() => {})) : options.onUndo}
          onAutoClose={close}
          duration={options.duration ?? TOAST_CONFIG.undoMs}
        />
      )}
    </>
  );
}
