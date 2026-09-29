import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Proactive counterpart to `reloadOnce`'s reactive recovery (main.tsx's
 * `vite:preloadError` listener, RouteErrorBoundary's chunk-error branch):
 * this tells a signed-in user a new build exists *before* they hit a broken
 * chunk, so they can reload on their own terms rather than mid-navigation.
 * Deliberately never reloads on its own - an admin mid-way through an entry
 * sheet or a lesson-note draft must not lose it to a background poll.
 *
 * Compares the build's own baked-in `__APP_VERSION__` (vite.config.ts's
 * `define`) against `/version.json` (emitted alongside it, `no-store` per
 * nginx.conf), polling on tab refocus - the moment a long-open tab is most
 * likely to have missed a deploy - and every `POLL_INTERVAL_MS` while
 * visible. Never polls while the tab is hidden.
 */
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data: { version?: string } = await response.json();
        if (!cancelled && data.version && data.version !== __APP_VERSION__) {
          setUpdateAvailable(true);
        }
      } catch {
        // Offline, or the dev server has no version.json at all - either
        // way, silently skip this check rather than surface a false alarm.
      }
    }

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return { updateAvailable, reload: () => window.location.reload() };
}
