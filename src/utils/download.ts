/**
 * Triggers a browser save-as for an in-memory blob (a report PDF fetched via
 * `api/client.ts`'s `apiFetchBlob`) - there's no `<a href>` to point at
 * since the app's private bucket means the bytes only ever exist after an
 * authenticated fetch, never at a public URL.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
