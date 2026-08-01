import { useEffect, useState } from "react";
import { type StudentAttendanceSummaryView, getStudentTermSummary } from "@/api/attendance";
import { ApiError } from "@/api/client";
import { listSessions, listTerms, type TermView } from "@/api/sessions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StatTile } from "@/components/ui/StatTile";
import { statusBadgeVariant } from "@/features/attendance/attendanceStatus";
import { formatLongDate } from "@/utils/date";

interface StudentAttendanceCardProps {
  studentId: string;
}

/**
 * One student's attendance for a term - totals plus a day-by-day list.
 * Owns its own session/term fetch (mirrors `ClassTermPicker`'s reasoning:
 * there's no store for it, and both places this card is used - the student
 * profile page, and the drill-down modal from a class term summary - need
 * the same cascade) and defaults to the current term.
 */
export function StudentAttendanceCard({ studentId }: StudentAttendanceCardProps) {
  const [sessionId, setSessionId] = useState("");
  const [terms, setTerms] = useState<TermView[]>([]);
  const [termId, setTermId] = useState("");
  const [summary, setSummary] = useState<StudentAttendanceSummaryView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listSessions(0, 50).then((page) => {
      const current = page.content.find((session) => session.current);
      if (current) setSessionId(current.id);
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    listTerms(sessionId).then((fetchedTerms) => {
      setTerms(fetchedTerms);
      const current = fetchedTerms.find((term) => term.current);
      setTermId(current?.id ?? fetchedTerms[0]?.id ?? "");
    });
  }, [sessionId]);

  // A student/term change resets downstream state during render (see ScoreEntryGrid's
  // comment on this pattern) rather than in an effect; the effect below only fetches.
  const selectionKey = `${studentId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setSummary(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!termId) return;
    getStudentTermSummary(studentId, termId)
      .then(setSummary)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load attendance"),
      );
  }, [studentId, termId]);

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-0">
        <h2 className="text-sm font-semibold text-slate-900">Attendance</h2>
        {terms.length > 0 && (
          <Select
            aria-label="Term"
            className="w-auto"
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
          >
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="p-6">
        {loadError && <Alert variant="error">{loadError}</Alert>}
        {!loadError && !summary && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        )}
        {summary && summary.daysMarked === 0 && (
          <EmptyState
            title="No attendance recorded"
            description="Nobody has marked this student's register this term yet."
          />
        )}
        {summary && summary.daysMarked > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatTile label="Present" value={summary.present} />
              <StatTile label="Absent" value={summary.absent} />
              <StatTile label="Late" value={summary.late} />
              <StatTile label="Excused" value={summary.excused} />
              <StatTile label="Rate" value={`${summary.attendanceRate.toFixed(1)}%`} />
            </div>
            <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto text-sm">
              {summary.days.map((day) => (
                <li
                  key={day.date}
                  className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0"
                >
                  <span className="text-slate-600">{formatLongDate(day.date)}</span>
                  <Badge variant={statusBadgeVariant(day.status)}>{day.status}</Badge>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
