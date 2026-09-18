import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { listMyTakeHomeQuizzes, type MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { formatInstant } from "@/utils/date";

/** `Badge` variant + label for one quiz row's status - availability first, then attempt state, then whether results are out. */
function statusBadge(quiz: MyTakeHomeQuizSummaryView): { variant: "success" | "warning" | "neutral"; label: string } {
  if (quiz.resultsPublished) {
    return { variant: "success", label: quiz.score === null ? "Not submitted" : `${quiz.score}/${quiz.totalPoints}` };
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
 * the caller's own class+current term. A flat page like `StudentResultsPage`: one student, no ward
 * selector. Once a quiz's results are published, its score is shown right here, the same content a
 * guardian already sees via `MyWardTakeHomeQuizzesService` (Phase 35I, confirmed with the user).
 */
export function StudentQuizzesPage() {
  const [quizzes, setQuizzes] = useState<MyTakeHomeQuizSummaryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    listMyTakeHomeQuizzes()
      .then((result) => {
        setQuizzes(result);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load your quizzes"));
  }

  useEffect(load, []);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quizzes" />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (quizzes === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Quizzes" description="Take-home quizzes from your teachers." />

      {quizzes.length === 0 && (
        <EmptyState title="No quizzes yet" description="Your teachers haven't published a take-home quiz yet." />
      )}

      <div className="space-y-2">
        {quizzes.map((quiz) => {
          const badge = statusBadge(quiz);
          return (
            <DrillRow
              key={quiz.id}
              to={`/student/quizzes/${quiz.id}`}
              title={quiz.title}
              meta={`${quiz.subjectName} · Closes ${formatInstant(quiz.closesAt)}`}
              trailing={<Badge variant={badge.variant}>{badge.label}</Badge>}
            />
          );
        })}
      </div>
    </div>
  );
}
