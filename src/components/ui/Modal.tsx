import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Minimal centered-overlay modal; closes on backdrop click. No portal - fine at this app's current nesting depth. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
        <div className={title ? "mt-4" : ""}>{children}</div>
      </div>
    </div>
  );
}
