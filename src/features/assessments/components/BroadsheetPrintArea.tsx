import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface BroadsheetPrintAreaProps {
  /** From `useBroadsheetPrint` - the print copy only exists while this is true. */
  printing: boolean;
  /** The printed page's heading, e.g. "Primary 1A - 2026/2027, First Term" - on screen the picker already says it. */
  title: string;
  children: ReactNode;
}

/**
 * Renders the broadsheet (and its grade key) on screen as usual, plus - only
 * while printing - a copy portalled straight under <body> as `.print-area`.
 * index.css's print rules drop every other child of <body>, so the paper
 * carries just this, unaffected by the portal shell's sidebar or scroll
 * containers. `hidden print:block` keeps the copy invisible on screen.
 */
export function BroadsheetPrintArea({ printing, title, children }: BroadsheetPrintAreaProps) {
  return (
    <>
      {children}
      {printing &&
        createPortal(
          <div className="print-area hidden space-y-4 bg-white print:block">
            <h1 className="font-display text-xl font-semibold text-slate-900">{title}</h1>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
