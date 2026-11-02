import { useEffect } from "react";
import { Navigate } from "react-router";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useWardStore } from "@/stores/wardStore";

/**
 * `/guardian/results` - the nav entry point. Sends the guardian straight to
 * the selected ward's latest result (`WardResultsHomePage`), or the first
 * ward when none is selected yet, so there's no ward list to tap through.
 * Only the loading, error and "no wards" states render here.
 */
export function WardResultsPage() {
  const { wards, selectedWardId, status, errorMessage, fetchIfNeeded, retry } = useWardStore();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  if (status === "loaded" && wards.length > 0) {
    const target = wards.some((ward) => ward.studentId === selectedWardId) ? selectedWardId : wards[0].studentId;
    return <Navigate to={`/guardian/results/${target}`} replace />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Results" description="Published term results for your wards." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={errorMessage ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}
    </div>
  );
}
