"use client";

import { useEffect, useState, useCallback } from "react";
import { GlobalConfirmModal } from "@/app/components/ui";
import { modalService } from "@/app/lib/services/modalService";
import type { ConfirmOptions } from "@/app/lib/services/modalService";

export function GlobalModalProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    modalService.register((opts) => {
      if (opts) {
        setOptions(opts);
        setOpen(true);
      } else {
        setOpen(false);
        setOptions(null);
      }
    });
    return () => modalService.unregister();
  }, []);

  const handleConfirm = useCallback(() => {
    options?.onConfirm();
    modalService.close();
  }, [options]);

  const handleClose = useCallback(() => {
    modalService.close();
  }, []);

  return (
    <>
      {children}
      {options && (
        <GlobalConfirmModal
          open={open}
          title={options.title}
          description={options.description}
          variant={options.variant}
          confirmLabel={options.confirmLabel}
          onConfirm={handleConfirm}
          onClose={handleClose}
        />
      )}
    </>
  );
}
