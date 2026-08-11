import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { StudentAttendanceSummaryView } from "@/api/attendance";
import { getWardAttendance } from "@/api/wards";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useWardAttendanceContext } from "@/features/guardian/WardAttendanceLayout";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { WardBreadcrumb } from "@/features/guardian/components/WardBreadcrumb";

type RateByTermId = Record<string, StudentAttendanceSummaryView | null>;

/**
 * Step 3 of the attendance drill-down - a session's terms in term-number
 * order. Unlike the results equivalent, every term is tappable (attendance
 * isn't publication-gated), so the trailing badge is an attendance-rate
 * summary instead of a published/unpublished marker: one
 * `getWardAttendance` call per term of *this* session only (bounded at ≤3
 * requests), not the whole ward's history.
 */
export function WardAttendanceSessionTermsPage() {
  const { ward, terms } = useWardAttendanceContext();
  const { sessionId } = useParams<{ sessionId: string }>();

  const sessionTerms = terms
    .filter((term) => term.sessionId === sessionId)
    .sort((a, b) => a.termNumber - b.termNumber);

  const [rates, setRates] = useState<RateByTermId>({});

  // A sessionId change resets the previously fetched rates during render
  // (the pattern `WardAttendanceLayout`/`WardResultsLayout` document) rather
  // than inside the effect below, which only fetches.
  const [lastSessionId, setLastSessionId] = useState(sessionId);
  if (sessionId !== lastSessionId) {
    setLastSessionId(sessionId);
    setRates({});
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      sessionTerms.map((term) =>
        getWardAttendance(ward.studentId, term.termId)
          .then((summary) => [term.termId, summary] as const)
          .catch(() => [term.termId, null] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setRates(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionTerms is derived fresh from terms/sessionId every render; re-running on its identity would loop
  }, [ward.studentId, sessionId]);

  if (sessionTerms.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Session not found" backTo={`/guardian/attendance/${ward.studentId}`} />
        <EmptyState
          title="Session not found"
          description="This session isn't part of this ward's enrolment history."
          action={
            <Link to={`/guardian/attendance/${ward.studentId}`} className="text-sm font-medium text-brand-700">
              Back to sessions
            </Link>
          }
        />
      </div>
    );
  }

  const sessionName = sessionTerms[0].sessionName;

  return (
    <div className="space-y-6">
      <PageHeader title={sessionName} backTo={`/guardian/attendance/${ward.studentId}`} />
      <WardBreadcrumb
        steps={[
          { label: ward.schoolName, to: "/guardian/attendance" },
          { label: ward.fullName, to: `/guardian/attendance/${ward.studentId}` },
          { label: sessionName },
        ]}
      />

      <div className="space-y-3">
        {sessionTerms.map((term) => {
          const rate = rates[term.termId];
          const trailing =
            rate === undefined ? (
              <Skeleton className="h-5 w-14" />
            ) : rate === null ? undefined : rate.daysMarked === 0 ? (
              <Badge variant="neutral">No register yet</Badge>
            ) : (
              <Badge variant="neutral">{rate.attendanceRate.toFixed(1)}%</Badge>
            );

          return (
            <DrillRow
              key={term.termId}
              to={`/guardian/attendance/${ward.studentId}/${sessionId}/${term.termId}`}
              title={term.termName}
              meta={term.className}
              trailing={trailing}
            />
          );
        })}
      </div>
    </div>
  );
}
