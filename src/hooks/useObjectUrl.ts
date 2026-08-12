import { useEffect, useState } from "react";

/**
 * Fetches `key` through `fetcher` (an authenticated blob endpoint - the
 * files bucket is private, so a bare `<img src="/api/v1/files/...">` can't
 * carry an Authorization header) and exposes it as an `URL.createObjectURL`
 * string, revoking the previous one on every change and on unmount. Shared
 * by `ImageUploadField`'s preview, the designer canvas's `ImagePreview`, and
 * student/ward photo avatars - each passes its own fetcher (`downloadFile`
 * by fileId, `downloadWardPhoto` by studentId) since the id shape differs.
 *
 * `fetcher` belongs in the dependency array like any other value an effect
 * reads - every current call site passes a stable module-level function
 * (`downloadFile`/`downloadWardPhoto`), never an inline arrow, so this never
 * re-fetches on an unrelated render.
 */
export function useObjectUrl(key: string | undefined, fetcher: (key: string) => Promise<Blob>): string | null {
  const [url, setUrl] = useState<string | null>(null);

  // `key` clearing (removed, or swapped to a different upload) resets the
  // stale preview during render rather than as a synchronous setState in
  // the effect below - the same pattern `AdminResultsPanel`'s
  // selectionKey/lastSelectionKey documents.
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    if (!key) setUrl(null);
  }

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetcher(key).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher is a stable module-level function at every call site, not a per-render value
  }, [key]);

  return url;
}
