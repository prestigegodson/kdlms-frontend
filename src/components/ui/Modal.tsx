import { X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";

type Size = "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Panel width: md (default form), lg (wider form, e.g. a repeating term grid), xl (dense multi-column content). */
  size?: Size;
  children: ReactNode;
}

const SIZE_CLASSES: Record<Size, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Minimal centered-overlay modal; closes on backdrop click, Escape, or the
 * close button. No portal - fine at this app's current nesting depth. Traps
 * Tab focus within the dialog while open, locks page scroll, and restores
 * focus to whatever triggered it on close. The panel caps at 90dvh with its
 * own internal scroll so a tall form (e.g. Sessions' repeating term rows)
 * never pushes its submit button off a short viewport.
 *
 * Below `md` this presents as a bottom sheet instead - docked to the
 * viewport bottom, full width, top-rounded only, capped at 92dvh, with a
 * grab handle and a slide-up entrance. The `mobile:` utility classes below
 * handle everything Tailwind can express (layout/sizing/rounding); the
 * `sheet-panel` class hooks the slide-in keyframe and grab-handle
 * pseudo-element that live in index.css, the same "one CSS mechanism, zero
 * call-site churn" split `.responsive-table` already uses - none of this
 * component's ~28 call sites need to change.
 */
export function Modal({ open, onClose, title, size = "lg", children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    triggerRef.current = document.activeElement;
    dialogRef.current?.focus();

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!focusable || focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 mobile:items-end mobile:justify-center mobile:p-0">
      <div className="overlay-fade fixed inset-0 bg-slate-900/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Dialog"}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`sheet-panel relative flex max-h-[90dvh] w-full flex-col rounded-card bg-white shadow-xl outline-none mobile:w-full mobile:max-w-none mobile:max-h-[92dvh] mobile:rounded-t-card mobile:rounded-b-none mobile:pb-[env(safe-area-inset-bottom)] ${SIZE_CLASSES[size]}`}
      >
        <div className="flex items-start justify-end gap-4 px-6 pt-6">
          {title && (
            <h2 id={titleId} className="mr-auto font-display text-lg font-medium text-slate-900">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-slate-400 hover:bg-slate-100 hover:text-slate-600 mobile:h-11 mobile:w-11"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6 pt-4 mobile:has-[[data-sheet-dock]]:pb-0">{children}</div>
      </div>
    </div>
  );
}
