import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getMyClassTimetable } from "@/api/student";
import type { ClassTimetableView } from "@/api/timetable";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { TimetableGrid } from "@/components/TimetableGrid";
import { useStudentStore } from "@/stores/studentStore";

/**
 * The student portal's own class timetable for one term - deliberately **not**
 * publication-gated, the same "live operational information" treatment the guardian ward
 * equivalent gets (CLAUDE.md's Domain Rules). A flat single page, the `WardTimetablePage` shape
 * minus the ward selector (there's one student, no picker) - just a Term `Select` docked in a
 * `StickySubHeader`. Reuses `TimetableGrid` read-only (`editable` is always `false` server-side
 * for this use case). There's no server-exposed "current term" flag on `StudentTermView` (only
 * `currentSession`), so the default selection is the current session's highest term number - the
 * same proxy `WardTimetablePage` documents.
 */
export function StudentTimetablePage() {
  const terms = useStudentStore((state) => state.terms);
  const status = useStudentStore((state) => state.status);
  const errorMessage = useStudentStore((state) => state.errorMessage);
  const fetchIfNeeded = useStudentStore((state) => state.fetchIfNeeded);
  const retry = useStudentStore((state) => state.retry);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const [termId, setTermId] = useState("");

  // Once terms load, default to the current session's highest term number - reset during render
  // (the WardTimetablePage pattern) rather than inside the effect below, which only fetches.
  // `lastTermsKey` starts at `null`, a sentinel no real key (even an empty one, before terms
  // load) ever equals - unlike WardTimetablePage's per-page fetch, `studentStore` is a shared
  // singleton that may already be "loaded" by the time this page mounts (e.g. navigating here
  // from the dashboard), so the very first render must still pick a default rather than only
  // reacting to a later idle->loaded transition that may never happen.
  const termsKey = status === "loaded" ? terms.map((term) => term.termId).join(",") : "";
  const [lastTermsKey, setLastTermsKey] = useState<string | null>(null);
  if (status === "loaded" && termsKey !== lastTermsKey) {
    setLastTermsKey(termsKey);
    const preferred = [...terms].filter((term) => term.currentSession).sort((a, b) => b.termNumber - a.termNumber)[0];
    setTermId(preferred?.termId ?? terms[0]?.termId ?? "");
  }

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

  return (
    <div className="space-y-6">
      <PageHeader title="Timetable" description="Your class's weekly schedule." />

      {status === "error" && (
        <ErrorState message={errorMessage ?? "Failed to load your profile"} onRetry={retry} />
      )}
      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}

      {status === "loaded" && terms.length > 0 && (
        <StickySubHeader>
          <FormField label="Term" htmlFor="student-timetable-term" className="min-w-0 flex-1 lg:max-w-xs">
            <Select id="student-timetable-term" value={termId} onChange={(event) => setTermId(event.target.value)}>
              <option value="">Select a term…</option>
              {terms.map((term) => (
                <option key={term.termId} value={term.termId}>
                  {term.termName} · {term.sessionName}
                </option>
              ))}
            </Select>
          </FormField>
        </StickySubHeader>
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
