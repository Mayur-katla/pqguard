import { CheckCircle2, Info, X } from "lucide-react";

interface ToastProps {
  message: string;
  tone?: "info" | "success";
  onDismiss: () => void;
}

export function Toast({ message, tone = "info", onDismiss }: ToastProps) {
  if (!message) return null;

  return (
    <div
      className={`fixed bottom-3 left-3 right-3 z-50 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-panel/95 p-3 text-body-sm text-ink shadow-panel backdrop-blur-xl sm:bottom-auto sm:left-auto sm:right-5 sm:top-5 sm:w-[420px] ${
        tone === "success" ? "border-proof/40" : "border-aurora/35"
      }`}
      role="status"
      aria-live="polite"
    >
      {tone === "success" ? <CheckCircle2 className="text-proof" size={18} /> : <Info className="text-aurora" size={18} />}
      <span className="min-w-0 text-muted">{message}</span>
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-elevated text-muted hover:border-aurora/60 hover:text-ink"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </div>
  );
}
