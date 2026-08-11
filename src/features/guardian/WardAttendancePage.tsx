import { useEffect } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { groupWardsBySchool } from "@/features/guardian/groupWardsBySchool";
import { useWardStore } from "@/stores/wardStore";

/**
 * Step 1 of the attendance drill-down (School › Ward › Session › Term ›
 * Summary) - every linked ward, grouped under a school heading (shown even
 * for a single-school guardian, unlike `WardsPage`'s grid). Mirrors
 * `WardResultsPage`: selecting a ward goes to step 2
 * (`WardAttendanceLayout` + `WardAttendanceSessionsPage`) rather than
 * fetching anything itself, so this stays a single request.
 */
export function WardAttendancePage() {
  const { wards, status, errorMessage, fetchIfNeeded, retry } = useWardStore();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Term attendance for your wards." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={errorMessage ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {status === "loaded" && wards.length > 0 && (
        <div className="space-y-6">
          {groupWardsBySchool(wards).map(([schoolName, schoolWards]) => (
            <div key={schoolName}>
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">
                {schoolName}
              </h2>
              <div className="space-y-3">
                {schoolWards.map((ward) => (
                  <DrillRow
                    key={ward.studentId}
                    to={`/guardian/attendance/${ward.studentId}`}
                    title={ward.fullName}
                    meta={`${ward.admissionNumber}${ward.currentClassName ? ` · ${ward.currentClassName}` : ""}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
