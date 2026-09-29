import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useVersionCheck } from "@/hooks/useVersionCheck";

/**
 * "A new version is available" strip, rendered by PortalShell above the
 * routed content for every portal - the proactive counterpart to
 * RouteErrorBoundary's reactive chunk-error recovery. Never auto-reloads
 * (see useVersionCheck's Javadoc-equivalent); the person chooses when.
 * Renders nothing until a poll actually finds a version mismatch, and (like
 * InstallBanner) has no dismiss affordance - a real deploy doesn't stop
 * being available just because it was dismissed once.
 */
export function UpdateBanner() {
  const { updateAvailable, reload } = useVersionCheck();

  if (!updateAvailable) {
    return null;
  }

  return (
    <Card className="mb-6 flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800">
        <RefreshCw className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-medium text-slate-900">A new version is available</p>
        <p className="mt-0.5 text-sm text-slate-600">Reload to get the latest features and fixes.</p>
      </div>
      <Button size="sm" onClick={reload} className="shrink-0">
        Reload
      </Button>
    </Card>
  );
}
