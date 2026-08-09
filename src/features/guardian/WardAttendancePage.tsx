import { useEffect, useState } from "react";
import type { StudentAttendanceSummaryView } from "@/api/attendance";
import { ApiError } from "@/api/client";
import { getWardAttendance } from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { AttendanceSummaryPanel } from "@/features/attendance/components/AttendanceSummaryPanel";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { WardTermSelect } from "@/features/guardian/components/WardTermSelect";
import { useWardStore } from "@/stores/wardStore";

/**
 * A ward's attendance for a term - ward + term pickers, then the same
 * `AttendanceSummaryPanel` the student profile page uses. Deliberately not
 * limited to published terms (`WardTermSelect` has no `filter` here) -
 * attendance is live operational information, unlike results (see
 * CLAUDE.md's Domain Rules).
 */
export function WardAttendancePage() {
  const { wards, selectedWardId, status, errorMessage: wardError, fetchIfNeeded, retry } = useWardStore();
  const [termId, setTermId] = useState("");
  const [summary, setSummary] = useState<StudentAttendanceSummaryView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const selectionKey = `${selectedWardId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setSummary(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!selectedWardId || !termId) return;
    getWardAttendance(selectedWardId, termId)
      .then(setSummary)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load attendance"),
      );
  }, [selectedWardId, termId]);

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Term attendance for your wards." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={wardError ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {hasWards && (
        <StickySubHeader>
          <WardSelector />
          {selectedWardId && (
            <WardTermSelect
              studentId={selectedWardId}
              termId={termId}
              onTermChange={(term) => setTermId(term.termId)}
              emptyMessage="This ward hasn't been enrolled for any term yet."
            />
          )}
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {hasWards && selectedWardId && termId && !summary && !loadError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading attendance…
        </div>
      )}

      {summary && <AttendanceSummaryPanel summary={summary} />}
    </div>
  );
}
