import { useCallback, useEffect, useState } from "react";
import type { MediaStreamUrlView } from "@/api/learning";

export interface MediaStreamUrlState {
  /** The presigned bucket URL to use as the media element's `src` - `null` until the first one arrives. */
  url: string | null;
  error: boolean;
  /** Fetches a fresh URL (e.g. once the current one has expired), keeping the old one in place until it arrives. */
  refresh: () => void;
}

/**
 * Where an mp3/mp4 learning resource plays from: a short-lived presigned bucket URL the browser's
 * `<audio>`/`<video>` element streams from directly, issuing its own `Range` requests - so playback
 * starts at once and seeking fetches only what it needs, rather than downloading the whole file
 * first. `fetcher` must be a stable module-level function, never an inline arrow (the
 * `useObjectUrl` rule) - it isn't in the effect's dependency array.
 */
export function useMediaStreamUrl(
  key: string | undefined,
  fetcher: (key: string) => Promise<MediaStreamUrlView>,
): MediaStreamUrlState {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [generation, setGeneration] = useState(0);

  // A different key (another resource, clearing, navigating away) resets during render rather than
  // in the effect, so a resource swap never briefly plays the previous resource.
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setUrl(null);
    setError(false);
  }

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetcher(key)
      .then((view) => {
        if (cancelled) return;
        setUrl(view.url);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher is a stable module-level function at every call site, not a per-render value
  }, [key, generation]);

  const refresh = useCallback(() => setGeneration((current) => current + 1), []);

  return { url, error, refresh };
}
