import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "@/api/health";
import { ApiError } from "@/api/client";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

type Status =
  { kind: "loading" } | { kind: "up"; health: HealthResponse } | { kind: "down"; message: string };

/**
 * Phase 0's visible proof that the frontend reaches the backend: polls the
 * unauthenticated health endpoint (proxied by Vite in dev, see
 * vite.config.ts) and renders the result.
 */
export function ConnectivityPanel() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((health) => {
        if (!cancelled) setStatus({ kind: "up", health });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.message : "Unable to reach backend";
        setStatus({ kind: "down", message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="max-w-md">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Backend connectivity
      </h2>
      <div className="mt-3 flex items-center gap-3">
        {status.kind === "loading" && (
          <>
            <Spinner className="text-brand-500" />
            <span className="text-sm text-slate-600">Checking /api/v1/health…</span>
          </>
        )}
        {status.kind === "up" && (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="text-sm text-slate-900">
              {status.health.application} v{status.health.version} is{" "}
              <span className="font-medium text-green-700">{status.health.status}</span>
            </span>
          </>
        )}
        {status.kind === "down" && (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-sm text-red-700">{status.message}</span>
          </>
        )}
      </div>
    </Card>
  );
}
