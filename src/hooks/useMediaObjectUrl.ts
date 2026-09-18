import { useEffect, useState } from "react";
import type { DownloadProgress } from "@/api/client";

export interface MediaObjectUrlState {
  url: string | null;
  loadedBytes: number;
  totalBytes: number | null;
  error: boolean;
}

const IDLE_STATE: MediaObjectUrlState = { url: null, loadedBytes: 0, totalBytes: null, error: false };

/**
 * The `useObjectUrl` shape, extended with download progress - for a large mp3/mp4 learning
 * resource (Phase 35F) whose player shows a determinate progress bar (`loadedBytes`/`totalBytes`)
 * rather than an indeterminate spinner for the whole transfer. `fetcher` must be a stable
 * module-level function, never an inline arrow, the same `useObjectUrl` requirement - it isn't in
 * the effect's dependency array.
 */
export function useMediaObjectUrl(
  key: string | undefined,
  fetcher: (key: string, onProgress: (progress: DownloadProgress) => void) => Promise<Blob>,
): MediaObjectUrlState {
  const [state, setState] = useState<MediaObjectUrlState>(IDLE_STATE);

  // `key` changing (a different resource, clearing, or navigating away) resets the stale state
  // during render rather than as a synchronous setState in the effect below - the useObjectUrl
  // precedent, extended here to every key change (not just clearing to falsy) so a resource swap
  // never briefly shows the previous resource's progress or player.
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setState(IDLE_STATE);
  }

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    fetcher(key, (progress) => {
      if (cancelled) return;
      setState((current) => ({ ...current, loadedBytes: progress.loadedBytes, totalBytes: progress.totalBytes }));
    })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState((current) => ({ ...current, url: objectUrl }));
      })
      .catch(() => {
        if (cancelled) return;
        setState((current) => ({ ...current, error: true }));
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher is a stable module-level function at every call site, not a per-render value
  }, [key]);

  return state;
}
