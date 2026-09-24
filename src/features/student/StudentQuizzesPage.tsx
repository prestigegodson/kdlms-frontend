import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { listMyTakeHomeQuizzes, type MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import type { Page } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { formatInstant } from "@/utils/date";

const PAGE_SIZE = 20;

/** `Badge` variant + label for one quiz row's status - availability first, then attempt state, then whether results are out. */
function statusBadge(quiz: MyTakeHomeQuizSummaryView): { variant: "success" | "warning" | "neutral"; label: string } {
  if (quiz.score !== null) {
    return { variant: "success", label: `${quiz.score}/${quiz.totalPoints}` };
  }
  if (quiz.resultsPublished) {
    return { variant: "success", label: "Not submitted" };
  }
  if (quiz.attemptState === "SUBMITTED") {
    return { variant: "neutral", label: "Submitted · awaiting results" };
  }
  if (quiz.availability === "CLOSED") {
    return { variant: "warning", label: "Closed" };
  }
  if (quiz.availability === "SCHEDULED") {
    return { variant: "neutral", label: "Not open yet" };
  }
  return { variant: "success", label: quiz.attemptState === "IN_PROGRESS" ? "In progress" : "Open" };
}

/**
 * The student portal's Quizzes tab (Phase 35I.3) - every applicable, published take-home quiz for
 * the caller's own class+current term (never a past term's), paginated server-side. A flat page like
 * `StudentResultsPage`: one student, no ward selector. A submitted quiz's score shows here as soon as it's reviewable - either the quiz's own
 * `revealResultsOnSubmit` opt-in, or the teacher publishing results, the same
 * `TakeHomeQuizAttemptRunner#isReviewable` gate the interstitial/review use - not gated on
 * `resultsPublished` alone the way the guardian ward view (`MyWardTakeHomeQuizzesService`,
 * Phase 35I) still is. A submitted attempt that isn't reviewable yet (`score === null`) renders as
 * an inert `DrillRow` - opening it would only ever land on `StudentQuizPage`'s "check back later"
 * card, never the score, since the backend gate is identical - so the row is disabled rather than
 * clickable-to-nothing.
 */
export function StudentQuizzesPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<Page<MyTakeHomeQuizSummaryView> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    listMyTakeHomeQuizzes(pageIndex, PAGE_SIZE)
      .then((result) => {
        setPage(result);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load your quizzes"));
  }

  useEffect(load, [pageIndex]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quizzes" />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (page === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Quizzes" description="Take-home quizzes from your teachers for this term." />

      {page.totalElements === 0 && (
        <EmptyState
          title="No quizzes this term"
          description="Your teachers haven't published a take-home quiz for this term yet."
        />
      )}

      <div className="space-y-2">
        {page.content.map((quiz) => {
          const badge = statusBadge(quiz);
          const awaitingResults = quiz.attemptState === "SUBMITTED" && (quiz.score === null || quiz.score === undefined);
          return (
            <DrillRow
              key={quiz.id}
              to={`/student/quizzes/${quiz.id}`}
              title={quiz.title}
              meta={`${quiz.subjectName} · Closes ${formatInstant(quiz.closesAt)}`}
              trailing={<Badge variant={badge.variant}>{badge.label}</Badge>}
              disabled={awaitingResults}
              disabledReason="Submitted · Results will appear once your teacher releases them"
            />
          );
        })}
      </div>

      <Pagination page={page} onPageChange={setPageIndex} />
    </div>
  );
}
