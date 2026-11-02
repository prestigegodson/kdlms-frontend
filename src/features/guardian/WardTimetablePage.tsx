import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { ApiError } from "@/api/client";
import { type ClassTimetableView } from "@/api/timetable";
import { getWardTimetable, listWardTerms, type WardTermView } from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { TimetableGrid } from "@/components/TimetableGrid";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { useWardStore } from "@/stores/wardStore";

/**
 * A ward's class timetable for the current term - deliberately **not**
 * publication-gated, the same "live operational information" treatment
 * `WardTermAttendancePage`/`WardMedicalModal` get (CLAUDE.md's Domain
 * Rules). A timetable is one current schedule to check, not a history to
 * browse, so there is no term picker: the page shows only the term the
 * ward's school has marked current (`WardTermView.currentTerm`), and an
 * empty state when the school has none or the ward isn't enrolled in that
 * term's session. Only `WardSelector` docks in the `StickySubHeader`.
 * Reuses `TimetableGrid` read-only (`editable` is always `false`
 * server-side for this use case).
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

  // undefined = still loading the ward's terms; null = no current term for this ward.
  const [currentTerm, setCurrentTerm] = useState<WardTermView | null | undefined>(undefined);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [view, setView] = useState<ClassTimetableView | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  // A ward change resets everything during render (the
  // WardMessagesPage/WardAttendanceLayout pattern) rather than inside the
  // effects below, which only fetch.
  const selectionKey = selectedWardId ?? "";
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setCurrentTerm(undefined);
    setTermsError(null);
    setView(null);
    setViewError(null);
  }

  useEffect(() => {
    if (!selectedWardId) return;
    listWardTerms(selectedWardId)
      .then((terms) => setCurrentTerm(terms.find((term) => term.currentTerm) ?? null))
      .catch((error: unknown) =>
        setTermsError(error instanceof ApiError ? error.message : "Failed to load this ward's terms"),
      );
  }, [selectedWardId]);

  const currentTermId = currentTerm?.termId;
  useEffect(() => {
    if (!selectedWardId || !currentTermId) return;
    getWardTimetable(selectedWardId, currentTermId)
      .then(setView)
      .catch((error: unknown) =>
        setViewError(error instanceof ApiError ? error.message : "Failed to load this ward's timetable"),
      );
  }, [selectedWardId, currentTermId]);

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Timetable" description="Your ward's weekly class schedule for the current term." />

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
        </StickySubHeader>
      )}

      {termsError && <Alert variant="error">{termsError}</Alert>}
      {viewError && <Alert variant="error">{viewError}</Alert>}

      {hasWards && currentTerm === undefined && !termsError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading timetable…
        </div>
      )}

      {hasWards && currentTerm === null && (
        <EmptyState
          icon={CalendarDays}
          title="No current term"
          description="Your ward's school hasn't started a term your ward is enrolled in yet."
        />
      )}

      {currentTerm && (
        <p className="text-sm text-slate-500">
          {currentTerm.termName} · {currentTerm.sessionName}
        </p>
      )}

      {currentTerm && !view && !viewError && (
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
