import { TOAST_CONFIG } from "@/app/lib/config/toast";

type ToastType = "success" | "error" | "info" | "undo";

export type ToastOptions = {
  message: string;
  type: ToastType;
  duration?: number;
  undoLabel?: string;
  onUndo?: () => void;
};

type ToastListener = (options: ToastOptions | null) => void;

class ToastService {
  private listener: ToastListener | null = null;

  register(listener: ToastListener) {
    this.listener = listener;
  }

  unregister() {
    this.listener = null;
  }

  show(options: ToastOptions) {
    this.listener?.(options);
  }

  undo(options: Omit<ToastOptions, "type">) {
    this.listener?.({ ...options, type: "undo" });
  }

  success(message: string) {
    this.show({ message, type: "success", duration: TOAST_CONFIG.successMs });
  }

  error(message: string) {
    this.show({ message, type: "error", duration: TOAST_CONFIG.errorMs });
  }

  info(message: string) {
    this.show({ message, type: "info", duration: TOAST_CONFIG.infoMs });
  }

  close() {
    this.listener?.(null);
  }
}

export const toastService = new ToastService();
