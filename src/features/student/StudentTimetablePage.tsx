import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getMyClassTimetable } from "@/api/student";
import type { ClassTimetableView } from "@/api/timetable";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { TimetableGrid } from "@/components/TimetableGrid";
import { useStudentStore } from "@/stores/studentStore";

/**
 * The student portal's own class timetable for the **current term only** - no term picker. The
 * term is the school's current term as resolved server-side (`MyStudentView.currentTermId`, from
 * `academicStructure.currentTerm`), cached in `studentStore.me`. Deliberately **not**
 * publication-gated, the same "live operational information" treatment the guardian ward
 * equivalent gets (CLAUDE.md's Domain Rules). Reuses `TimetableGrid` read-only (`editable` is
 * always `false` server-side for this use case).
 */
export function StudentTimetablePage() {
  const me = useStudentStore((state) => state.me);
  const status = useStudentStore((state) => state.status);
  const errorMessage = useStudentStore((state) => state.errorMessage);
  const fetchIfNeeded = useStudentStore((state) => state.fetchIfNeeded);
  const retry = useStudentStore((state) => state.retry);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const termId = status === "loaded" ? (me?.currentTermId ?? "") : "";

  const [view, setView] = useState<ClassTimetableView | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  const [lastTermId, setLastTermId] = useState(termId);
  if (termId !== lastTermId) {
    setLastTermId(termId);
    setView(null);
    setViewError(null);
  }

  useEffect(() => {
    if (!termId) return;
    getMyClassTimetable(termId)
      .then(setView)
      .catch((error: unknown) =>
        setViewError(error instanceof ApiError ? error.message : "Failed to load your timetable"),
      );
  }, [termId]);

  const description = me?.currentTermName
    ? `Your class's weekly schedule for ${me.currentTermName}${me.sessionName ? ` · ${me.sessionName}` : ""}.`
    : "Your class's weekly schedule.";

  return (
    <div className="space-y-6">
      <PageHeader title="Timetable" description={description} />

      {status === "error" && (
        <ErrorState message={errorMessage ?? "Failed to load your profile"} onRetry={retry} />
      )}
      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}

      {status === "loaded" && !termId && (
        <EmptyState
          icon={CalendarDays}
          title="No current term"
          description="Your timetable will appear here once the school starts a term."
        />
      )}

      {viewError && <Alert variant="error">{viewError}</Alert>}

      {termId && !view && !viewError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading timetable…
        </div>
      )}

      {view && view.periods.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No timetable yet"
          description="Your class's timetable hasn't been filled in for this term yet."
        />
      )}
      {view && view.periods.length > 0 && (
        <TimetableGrid view={view} subjects={[]} teachers={[]} onSaved={() => {}} />
      )}
    </div>
  );
}
