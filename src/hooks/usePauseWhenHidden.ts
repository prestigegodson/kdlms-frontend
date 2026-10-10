import { useEffect, useRef } from "react";

/**
 * Calls `onHide` when the viewer stops watching the page: the tab is hidden (switched away,
 * minimised, phone locked) or - unless `onBlur` is `false` - the window loses focus to another
 * app or window. Media players pass a callback that pauses playback.
 *
 * `onBlur: false` is for a cross-origin iframe player (YouTube): clicking into the iframe itself
 * moves focus out of this window, so a `blur` listener would pause it the moment play is pressed.
 */
export function usePauseWhenHidden(onHide: () => void, { onBlur = true }: { onBlur?: boolean } = {}) {
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  });

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        onHideRef.current();
      }
    }
    function handleBlur() {
      onHideRef.current();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (onBlur) {
      window.addEventListener("blur", handleBlur);
    }
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [onBlur]);
}
