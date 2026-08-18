import { useInstallPromptStore } from "@/stores/installPromptStore";

export type InstallPlatform = "chromium" | "ios" | "other";

/**
 * The one module in the app that touches install/platform-detection browser
 * APIs directly - every other responsive/platform behaviour here is
 * CSS-gated (see CLAUDE.md's note on `Accordion` needing no `matchMedia`
 * stub in tests) precisely so that only this module ever needs one.
 */

/**
 * True once the app is actually running as an installed PWA (standalone
 * display mode), on any platform. `navigator.standalone` is iOS Safari's own
 * pre-standard flag - `display-mode: standalone` doesn't apply there.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const standaloneMedia =
    typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneMedia || iosStandalone;
}

/**
 * `beforeinstallprompt` only exists on Chromium; iOS Safari (and Firefox)
 * never fire it, so it needs its own instructions path instead. iPadOS 13+
 * reports as a Mac in its UA string, so a touch-capable "Macintosh" is
 * treated as iOS too - `navigator.maxTouchPoints > 1` is what a real Mac
 * with a mouse never reports.
 */
export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") {
    return "other";
  }
  const ua = navigator.userAgent;
  const isIPhoneOrIPad = /iphone|ipad|ipod/i.test(ua);
  const isIpadOS13Plus = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  if (isIPhoneOrIPad || isIpadOS13Plus) {
    return "ios";
  }
  // beforeinstallprompt itself is the real signal for "chromium" - this only
  // decides which fallback copy an install-eligible-but-not-yet-fired state
  // would show, since detectInstallPlatform runs once at boot, before
  // captureInstallPrompt has necessarily fired.
  return "chromium";
}

/**
 * Registers the deliberately-empty public/sw.js, purely to satisfy
 * Chromium's installability criteria (a service worker with a fetch handler
 * is a hard requirement for `beforeinstallprompt` to fire) - see CLAUDE.md's
 * PWA note. Registered in every environment, not just production: the
 * worker does nothing but pass requests through, so there's no dev-mode
 * staleness risk, and gating it on prod would make the feature impossible
 * to exercise with `npm run dev`.
 */
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
    // A failed registration only costs the install prompt, not the app
    // itself - never let it interrupt startup.
    console.error("Service worker registration failed", error);
  });
}

/**
 * Attaches the two module-scope listeners `installPromptStore` depends on.
 * Called once from main.tsx, at module scope rather than inside a React
 * component, because `beforeinstallprompt` can fire before the app has even
 * mounted.
 */
export function captureInstallPrompt(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (isStandalone()) {
    useInstallPromptStore.getState().markInstalled();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppresses Chrome's own mini-infobar so the in-app banner is the only
    // prompt a user sees.
    event.preventDefault();
    useInstallPromptStore.getState().setDeferredPrompt(event);
  });

  window.addEventListener("appinstalled", () => {
    useInstallPromptStore.getState().markInstalled();
  });
}
