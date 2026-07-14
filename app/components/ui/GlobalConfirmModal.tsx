"use client";

import { useEffect, useCallback } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { AppModal, AppButton } from "./";

export interface GlobalConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  variant: "destructive" | "sensitive";
  title: string;
  description: string;
}

export function GlobalConfirmModal({
  open,
  onClose,
  onConfirm,
  variant,
  title,
  description,
}: GlobalConfirmModalProps) {
  const isDestructive = variant === "destructive";
  const Icon = isDestructive ? AlertTriangle : HelpCircle;
  const iconBg = isDestructive ? "bg-error" : "bg-warning";
  const iconColor = isDestructive ? "text-error-text" : "text-warning-text";

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    },
    [open, onClose, onConfirm],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AppModal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-2">
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-xl ${iconBg}`}
        >
          <Icon size={32} className={iconColor} />
        </div>
        <h2 className="text-lg font-semibold text-center text-text-primary">
          {title}
        </h2>
        <p className="text-sm text-text-secondary text-center max-w-sm">
          {description}
        </p>
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t border-border mt-4">
        <AppButton variant="ghost" onClick={onClose}>
          Cancel
        </AppButton>
        <AppButton
          variant={isDestructive ? "destructive" : "primary"}
          onClick={onConfirm}
        >
          Confirm
        </AppButton>
      </div>
    </AppModal>
  );
}
