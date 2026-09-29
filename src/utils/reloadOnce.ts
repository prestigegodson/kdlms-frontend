const STORAGE_KEY = "kdlms:last-stale-reload";
const GUARD_WINDOW_MS = 10_000;

/**
 * Reloads the page to pick up a new deploy, but at most once per
 * `GUARD_WINDOW_MS` - without this, a build that's *itself* broken (a chunk
 * that 404s even on the freshly-reloaded page) would otherwise reload in a
 * tight loop instead of surfacing as a visible failure. `sessionStorage`
 * survives the reload it triggers (unlike component state), which is the
 * whole point.
 *
 * Used both by main.tsx's `vite:preloadError` listener (a failed dynamic
 * `import()`, e.g. a lazy route chunk nginx's `/assets/` now 404s instead of
 * serving stale HTML for) and by RouteErrorBoundary's chunk-error branch,
 * so the two recovery paths can't disagree on the guard.
 */
export function reloadOnce(): boolean {
  try {
    const last = sessionStorage.getItem(STORAGE_KEY);
    if (last && Date.now() - Number(last) < GUARD_WINDOW_MS) {
      return false;
    }
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Private browsing / storage disabled - fall through and reload anyway;
    // worst case is one un-guarded reload rather than none at all.
  }
  window.location.reload();
  return true;
}

// Matches Vite's own dynamic-import failure message plus the older webpack
// phrasing some error-tracking snippets still search for, so a stale chunk
// is recognized regardless of which bundler produced the running build.
const CHUNK_LOAD_ERROR_PATTERN =
  /dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch dynamically imported module/i;

/** True for an error that looks like a lazy-route chunk 404ing after a new deploy - see reloadOnce's Javadoc-equivalent above. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_LOAD_ERROR_PATTERN.test(message);
}
