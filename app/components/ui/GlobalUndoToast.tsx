"use client";

import { useEffect } from "react";
import { AppButton } from "./";

export interface GlobalUndoToastProps {
  open: boolean;
  message: string;
  undoLabel?: string;
  onUndo: () => void;
  onAutoClose: () => void;
  duration?: number;
}

export function GlobalUndoToast({
  open,
  message,
  undoLabel = "Undo",
  onUndo,
  onAutoClose,
  duration = 10000,
}: GlobalUndoToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onAutoClose, duration);
    return () => clearTimeout(timer);
  }, [open, duration, onAutoClose]);

  if (!open) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-bg-card border border-border shadow-lg radius-lg overflow-hidden"
      style={{
        animation: "toastIn 350ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}
      role="alert"
      aria-live="polite"
    >
      <div className="p-4 flex items-center gap-3">
        <span className="text-sm flex-1 text-text-primary">{message}</span>
        <AppButton
          variant="secondary"
          size="sm"
          onClick={() => {
            onUndo();
          }}
        >
          {undoLabel}
        </AppButton>
      </div>
      <div
        className="h-0.5 bg-primary"
        style={{
          animation: `toastShrink ${duration}ms linear forwards`,
          transformOrigin: "left",
        }}
      />
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
