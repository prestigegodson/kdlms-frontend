import { AlertTriangle, Archive, Building2, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { type AdminDashboardView, getAdminDashboard } from "@/api/dashboard";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatTileSkeleton } from "@/components/ui/StatTileSkeleton";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; view: AdminDashboardView }
  | { kind: "error"; message: string };

/** SYSTEM_ADMIN landing page - platform-wide school and subscription counts. */
export function AdminDashboardPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(() => {
    return getAdminDashboard()
      .then((view) => setState({ kind: "loaded", view }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load the dashboard",
        }),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function retryLoad() {
    setRetrying(true);
    load().finally(() => setRetrying(false));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Platform-wide schools and subscriptions." />

      {state.kind === "error" && <ErrorState message={state.message} onRetry={retryLoad} retrying={retrying} />}

      {state.kind === "loading" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <StatTileSkeleton key={index} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <StatTileSkeleton key={index} />
            ))}
          </div>
        </>
      )}

      {state.kind === "loaded" && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Schools</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={Building2} label="Total schools" value={state.view.totalSchools} to="/admin/schools" />
              <StatTile icon={CheckCircle2} label="Active" value={state.view.activeSchools} to="/admin/schools" />
              <StatTile icon={PauseCircle} label="Suspended" value={state.view.suspendedSchools} to="/admin/schools" />
              <StatTile icon={Archive} label="Archived" value={state.view.archivedSchools} to="/admin/schools" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Subscriptions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile icon={CheckCircle2} label="Active" value={state.view.activeSubscriptions} />
              <StatTile
                icon={AlertTriangle}
                label="Expiring within 14 days"
                value={state.view.expiringSoonSubscriptions}
              />
              <StatTile icon={XCircle} label="Expired" value={state.view.expiredSubscriptions} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
