import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { ApiError } from "@/api/client";
import { type ClassTimetableView } from "@/api/timetable";
import { getWardTimetable, listWardTerms, type WardTermView } from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { TimetableGrid } from "@/components/TimetableGrid";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { useWardStore } from "@/stores/wardStore";

/**
 * A ward's class timetable for one term - deliberately **not**
 * publication-gated, the same "live operational information" treatment
 * `WardTermAttendancePage`/`WardMedicalModal` get (CLAUDE.md's Domain
 * Rules). Unlike the Results/Attendance drill-down (school -> ward ->
 * session -> term, each its own route), this is a flat single page - a
 * timetable is one current schedule to check, not a history to browse
 * session by session - so `WardSelector` and a plain Term `Select` both dock
 * in one `StickySubHeader`, the `WardMessagesPage`/`TeacherTimetablePanel`
 * shape. Reuses `TimetableGrid` read-only (`editable` is always `false`
 * server-side for this use case), the "one component, two callers"
 * precedent `AttendanceSummaryPanel`/`ThreadCard` already set. There's no
 * server-exposed "current term" flag on `WardTermView` (only
 * `currentSession`), so the default selection is the current session's
 * highest term number - the best available proxy for "the term running now"
 * without inventing a new endpoint.
 */
export function WardTimetablePage() {
  const {
    wards,
    selectedWardId,
    status,
    errorMessage: wardsError,
    fetchIfNeeded,
    retry,
  } = useWardStore();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const [terms, setTerms] = useState<WardTermView[]>([]);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termId, setTermId] = useState("");

  // A ward change resets its term list + selection during render (the
  // WardMessagesPage/WardAttendanceLayout pattern) rather than inside the
  // effect below, which only fetches.
  const selectionKey = selectedWardId ?? "";
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setTerms([]);
    setTermsError(null);
    setTermId("");
  }

  useEffect(() => {
    if (!selectedWardId) return;
    listWardTerms(selectedWardId)
      .then((fetchedTerms) => {
        setTerms(fetchedTerms);
        const preferred = [...fetchedTerms]
          .filter((term) => term.currentSession)
          .sort((a, b) => b.termNumber - a.termNumber)[0];
        setTermId(preferred?.termId ?? fetchedTerms[0]?.termId ?? "");
      })
      .catch((error: unknown) =>
        setTermsError(error instanceof ApiError ? error.message : "Failed to load this ward's terms"),
      );
  }, [selectedWardId]);

  const [view, setView] = useState<ClassTimetableView | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  const [lastTermId, setLastTermId] = useState(termId);
  if (termId !== lastTermId) {
    setLastTermId(termId);
    setView(null);
    setViewError(null);
  }

  useEffect(() => {
    if (!selectedWardId || !termId) return;
    getWardTimetable(selectedWardId, termId)
      .then(setView)
      .catch((error: unknown) =>
        setViewError(error instanceof ApiError ? error.message : "Failed to load this ward's timetable"),
      );
  }, [selectedWardId, termId]);

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Timetable" description="Your ward's weekly class schedule." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={wardsError ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {hasWards && (
        <StickySubHeader>
          <WardSelector />
          <FormField label="Term" htmlFor="ward-timetable-term" className="min-w-0 flex-1 lg:max-w-xs">
            <Select id="ward-timetable-term" value={termId} onChange={(event) => setTermId(event.target.value)}>
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

      {termsError && <Alert variant="error">{termsError}</Alert>}
      {viewError && <Alert variant="error">{viewError}</Alert>}

      {hasWards && terms.length === 0 && !termsError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading terms…
        </div>
      )}

      {termId && !view && !viewError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading timetable…
        </div>
      )}

      {view && view.periods.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No timetable yet"
          description="This class's timetable hasn't been filled in for this term yet."
        />
      )}
      {view && view.periods.length > 0 && (
        <TimetableGrid view={view} subjects={[]} teachers={[]} onSaved={() => {}} />
      )}
    </div>
  );
}
