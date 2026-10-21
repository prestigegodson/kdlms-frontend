import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Whether a print is in progress, for BroadsheetPrintArea to mount its
 * body-level print copy only then (so the on-screen DOM never holds two
 * broadsheets). Covers both the Print button (`print`) and the browser's own
 * Ctrl+P (`beforeprint`). The state flips synchronously - via flushSync -
 * so the copy is in the DOM before the browser lays out the printed page.
 * It clears on `afterprint`; a browser without that event (iOS 12 Safari)
 * just keeps the copy mounted, which index.css hides on screen anyway.
 */
export function useBroadsheetPrint(): { printing: boolean; print: () => void } {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const start = () => flushSync(() => setPrinting(true));
    const end = () => setPrinting(false);
    window.addEventListener("beforeprint", start);
    window.addEventListener("afterprint", end);
    return () => {
      window.removeEventListener("beforeprint", start);
      window.removeEventListener("afterprint", end);
    };
  }, []);

  function print() {
    flushSync(() => setPrinting(true));
    window.print();
  }

  return { printing, print };
}
