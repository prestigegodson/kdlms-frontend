import { useEffect, useState } from "react";
import { useParams } from "react-router";
import type { StudentAttendanceSummaryView } from "@/api/attendance";
import { ApiError } from "@/api/client";
import { getWardAttendance } from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { AttendanceSummaryPanel } from "@/features/attendance/components/AttendanceSummaryPanel";
import { useWardAttendanceContext } from "@/features/guardian/WardAttendanceLayout";
import { WardBreadcrumb } from "@/features/guardian/components/WardBreadcrumb";

/**
 * Step 4 of the attendance drill-down - the term summary itself.
 * `studentId`/`sessionId`/`termId` come from the URL, so a route change
 * (switching term via the breadcrumb, or a direct bookmark) remounts this
 * page. Unlike `WardTermResultPage`, there's no publication gate to
 * distinguish from a genuine 404 - attendance is deliberately not
 * publication-gated (CLAUDE.md's Domain Rules), and `AttendanceSummaryPanel`
 * already renders its own empty state for a term with no register marked.
 */
export function WardTermAttendancePage() {
  const { ward, terms } = useWardAttendanceContext();
  const { sessionId, termId } = useParams<{ sessionId: string; termId: string }>();
  const [summary, setSummary] = useState<StudentAttendanceSummaryView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // A term change resets the previous term's summary during render (the
  // pattern `WardResultsLayout` documents) rather than inside the effect
  // below, which only fetches.
  const [lastTermId, setLastTermId] = useState(termId);
  if (termId !== lastTermId) {
    setLastTermId(termId);
    setSummary(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!termId) return;
    getWardAttendance(ward.studentId, termId)
      .then(setSummary)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load attendance"),
      );
  }, [ward.studentId, termId]);

  const term = terms.find((candidate) => candidate.termId === termId);
  const title = term ? `${term.termName} · ${term.sessionName}` : "Attendance";

  return (
    <div className="space-y-6">
      <PageHeader title={title} backTo={`/guardian/attendance/${ward.studentId}/${sessionId}`} />
      {term && (
        <WardBreadcrumb
          steps={[
            { label: ward.schoolName, to: "/guardian/attendance" },
            { label: ward.fullName, to: `/guardian/attendance/${ward.studentId}` },
            { label: term.sessionName, to: `/guardian/attendance/${ward.studentId}/${sessionId}` },
            { label: term.termName },
          ]}
        />
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {!summary && !loadError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading attendance…
        </div>
      )}

      {summary && <AttendanceSummaryPanel summary={summary} />}
    </div>
  );
}
