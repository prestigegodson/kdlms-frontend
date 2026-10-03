import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches, kept live as the viewport changes. Falls back to
 * `false` where `matchMedia` doesn't exist (jsdom), so desktop is the default under test.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => undefined;
      }
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Below `lg` (1024px): the sidebar becomes the bottom tab bar - see PortalShell/MobileTabBar. */
export const BELOW_LG_QUERY = "(max-width: 1023.98px)";
/** Below `md`: index.css's `mobile:` variant - dialogs become bottom sheets. */
export const MOBILE_QUERY = "(max-width: 767.98px)";
