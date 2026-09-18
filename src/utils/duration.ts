/**
 * Formats a media duration in whole seconds as `m:ss`, or `h:mm:ss` past an hour -
 * `formatDuration(90)` -> `"1:30"`, `formatDuration(3725)` -> `"1:02:05"`. Returns `null` for a
 * missing/invalid value (a `RICH_TEXT`/`YOUTUBE` resource's `durationSeconds`, or an mp3/mp4 whose
 * duration couldn't be probed client-side) - the caller decides whether to render a fallback.
 */
export function formatDuration(totalSeconds: number | null | undefined): string | null {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return null;
  }
  const seconds = Math.floor(totalSeconds % 60);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}

/** Formats a byte count as a compact "27.1 MB" / "512 KB" label - the media player's download-progress readout. */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return null;
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${Math.round(kilobytes)} KB`;
  }
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(1)} MB`;
}
