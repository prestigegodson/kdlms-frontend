import { useEffect, useState } from "react";
import { Outlet, useOutletContext, useParams } from "react-router";
import { ApiError } from "@/api/client";
import { listWardTerms, type MyWardView, type WardTermView } from "@/api/wards";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { useWardStore } from "@/stores/wardStore";

interface WardAttendanceContextValue {
  ward: MyWardView;
  terms: WardTermView[];
}

/** Read by `WardAttendanceSessionsPage`/`WardAttendanceSessionTermsPage`/`WardTermAttendancePage` - must only be called from inside `WardAttendanceLayout`'s route subtree. */
export function useWardAttendanceContext(): WardAttendanceContextValue {
  return useOutletContext<WardAttendanceContextValue>();
}

type TermsState =
  | { status: "loading" }
  | { status: "loaded"; terms: WardTermView[] }
  | { status: "not-found" }
  | { status: "error"; message: string };

/**
 * Owns the one `listWardTerms` fetch shared by steps 2-4 of the attendance
 * drill-down (`/guardian/attendance/:studentId/**`), resolves `:studentId`
 * against `wardStore`, and renders every loading/error/not-found state once
 * so the three leaf pages don't repeat them. Also keeps `wardStore`'s
 * selection in sync with the URL, so a guardian who switches to Results or
 * Messages mid-drill-down lands on the same ward they were just viewing.
 * Mirrors `WardResultsLayout` - attendance isn't publication-gated, but the
 * data shape and loading states are identical.
 */
export function WardAttendanceLayout() {
  const { studentId } = useParams<{ studentId: string }>();
  const { wards, status: wardsStatus, errorMessage: wardsError, fetchIfNeeded, retry, select } = useWardStore();
  const [termsState, setTermsState] = useState<TermsState>({ status: "loading" });

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  useEffect(() => {
    if (studentId) select(studentId);
  }, [studentId, select]);

  // A studentId change (navigating between wards) resets the fetched terms
  // during render (the pattern `WardResultsLayout` documents) rather than
  // inside the effect below, which only fetches. `retryToken`
  // lets `ErrorState`'s Retry action re-run the same effect without a
  // studentId change.
  const [lastStudentId, setLastStudentId] = useState(studentId);
  const [retryToken, setRetryToken] = useState(0);
  if (studentId !== lastStudentId) {
    setLastStudentId(studentId);
    setTermsState({ status: "loading" });
  }

  useEffect(() => {
    if (!studentId) return;
    listWardTerms(studentId)
      .then((terms) => setTermsState({ status: "loaded", terms }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setTermsState({ status: "not-found" });
          return;
        }
        setTermsState({
          status: "error",
          message: error instanceof ApiError ? error.message : "Failed to load this ward's attendance",
        });
      });
  }, [studentId, retryToken]);

  function retryTerms() {
    setTermsState({ status: "loading" });
    setRetryToken((token) => token + 1);
  }

  if (!studentId) {
    return <EmptyState title="Ward not found" description="Choose a ward from your attendance list." />;
  }

  if (wardsStatus === "idle" || wardsStatus === "loading" || termsState.status === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  if (wardsStatus === "error") {
    return <ErrorState message={wardsError ?? "Failed to load your wards"} onRetry={retry} />;
  }

  const ward = wards.find((candidate) => candidate.studentId === studentId);
  if (!ward || termsState.status === "not-found") {
    return <EmptyState title="Ward not found" description="Choose a ward from your attendance list." />;
  }

  if (termsState.status === "error") {
    return <ErrorState message={termsState.message} onRetry={retryTerms} />;
  }

  return <Outlet context={{ ward, terms: termsState.terms } satisfies WardAttendanceContextValue} />;
}
