import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

interface ModalProps {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function Modal({ title, subtitle, open, onClose, children, wide }: ModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const animationFrame = window.requestAnimationFrame(() => {
      const modal = modalRef.current;
      const focusable = modal ? Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector)) : [];
      (focusable[0] ?? modal)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-overlay/80 p-3 backdrop-blur-xl sm:p-5" role="presentation" onMouseDown={onClose}>
      <div
        ref={modalRef}
        className={`max-h-[92vh] w-full overflow-hidden rounded-2xl border border-line/80 bg-panel shadow-panel outline-none animate-scale-in ${wide ? "max-w-6xl" : "max-w-2xl"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
          <div className="min-w-0">
            <span className="text-caption font-bold uppercase text-aurora">PRGuard console</span>
            <h2 id={titleId} className="mt-1 text-title-xl text-ink">
              {title}
            </h2>
            {subtitle ? (
              <p id={subtitleId} className="mt-1 text-body-sm text-muted">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line/80 bg-elevated text-muted transition hover:border-aurora/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[calc(92vh-92px)] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}
