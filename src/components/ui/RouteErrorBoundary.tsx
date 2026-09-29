import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { NotFoundPage } from "@/components/ui/NotFoundPage";
import { isChunkLoadError, reloadOnce } from "@/utils/reloadOnce";

/**
 * The router's shared `errorElement` (mounted once, at `RootLayout`) - it
 * previously reused `NotFoundPage` for everything, which mislabeled a real
 * render crash as "page not found". `isRouteErrorResponse` is true only for
 * an actual unmatched route/thrown `Response` (a genuine 404); anything
 * else reaching here is an uncaught error from a page's render.
 *
 * A lazy route chunk 404ing after a new deploy (see nginx.conf's `/assets/`
 * location and main.tsx's `vite:preloadError` listener) surfaces here too,
 * as a thrown fetch/import error rather than that event - React Router's
 * own lazy-loading path doesn't go through Vite's preload-error event at
 * all. `isChunkLoadError` recognizes it and reloads automatically
 * (`reloadOnce` guards against a genuinely broken deploy looping); everything
 * else gets the generic crash message with a manual reload button.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const staleBuild = !isRouteErrorResponse(error) && isChunkLoadError(error);

  useEffect(() => {
    if (staleBuild) {
      reloadOnce();
    }
  }, [staleBuild]);

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  if (staleBuild) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <RefreshCw className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="font-display text-2xl font-medium text-slate-900">A new version is available</h1>
        <p className="text-sm text-slate-500">Reloading to get the latest version…</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 text-sm font-medium text-brand-500 hover:text-brand-600"
        >
          Reload now
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="font-display text-2xl font-medium text-slate-900">Something went wrong</h1>
      <p className="text-sm text-slate-500">
        This page hit an unexpected error. Reloading usually fixes it.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 text-sm font-medium text-brand-500 hover:text-brand-600"
      >
        Reload page
      </button>
    </div>
  );
}
