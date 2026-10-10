import { useEffect, useRef } from "react";

/** How old a nav-gating store's answer may get before a resume refetches it. */
export const NAV_GATE_MAX_AGE_MS = 5 * 60_000;

/**
 * Calls `revalidate` when the viewer comes back to the page: the tab becomes visible, the window
 * regains focus, or the browser comes back online - the inverse of usePauseWhenHidden. The portal
 * layouts pass a callback that revalidates the stores their nav items' `visible()` gates read, so
 * a fetch that failed while the laptop was waking (network still reconnecting, backend restarting)
 * heals itself instead of hiding nav items until a manual reload.
 *
 * Those three events usually arrive together, so calls are throttled to one per `minIntervalMs`.
 */
export function useRevalidateOnResume(
  revalidate: () => void,
  { minIntervalMs = 30_000 }: { minIntervalMs?: number } = {},
) {
  const revalidateRef = useRef(revalidate);
  useEffect(() => {
    revalidateRef.current = revalidate;
  });

  useEffect(() => {
    let lastRun = Number.NEGATIVE_INFINITY;
    function run() {
      const now = Date.now();
      if (now - lastRun < minIntervalMs) {
        return;
      }
      lastRun = now;
      revalidateRef.current();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        run();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
    };
  }, [minIntervalMs]);
}
