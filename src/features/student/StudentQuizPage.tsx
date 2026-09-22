import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  getMyTakeHomeQuiz,
  saveMyTakeHomeQuizAnswers,
  startMyTakeHomeQuiz,
  submitMyTakeHomeQuiz,
  type MyQuizInterstitialView,
} from "@/api/myTakeHomeQuizzes";
import type { QuizAttemptView } from "@/api/publicTakeHomeQuiz";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { PortalQuizImage } from "@/features/student/components/PortalQuizImage";
import { QuizRunner } from "@/features/takeHomeQuizzes/runner/QuizRunner";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";
import { formatInstant } from "@/utils/date";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "interstitial"; data: MyQuizInterstitialView }
  | { kind: "inProgress"; attempt: QuizAttemptView }
  | { kind: "submitted"; title: string | null };

/**
 * The student portal's quiz-taking screen (Phase 35I.3) - the authenticated twin of
 * `TakeHomeQuizPublicPage`, resolved by `quizId` (never a token) and rendered inside the ordinary
 * portal shell rather than full-viewport chrome. Shares the same `QuizRunner` state machine (timer,
 * autosave, buffer, submit) via its own `QuizTransport`. No score is shown here even once results
 * are published - that lives on `StudentQuizzesPage`'s own list row (Phase 35I, confirmed with the
 * user), matching this module's existing "no per-question breakdown at v1" stance.
 */
export function StudentQuizPage() {
  const { quizId = "" } = useParams<{ quizId: string }>();
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyTakeHomeQuiz(quizId)
      .then((data) => {
        if (cancelled) return;
        setStatus(
          data.attemptState === "SUBMITTED" ? { kind: "submitted", title: data.title } : { kind: "interstitial", data },
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus({ kind: "error", message: getErrorMessage(error, "Failed to load this quiz") });
      });
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  function handleStart() {
    setStarting(true);
    startMyTakeHomeQuiz(quizId)
      .then((attempt) => setStatus({ kind: "inProgress", attempt }))
      .catch((error: unknown) => setStatus({ kind: "error", message: getErrorMessage(error, "Failed to load this quiz") }))
      .finally(() => setStarting(false));
  }

  const transport: QuizTransport = {
    bufferKey: `portal:${quizId}`,
    saveAnswers: (answers) => saveMyTakeHomeQuizAnswers(quizId, answers),
    submit: () => submitMyTakeHomeQuiz(quizId),
    renderQuestionImage: (fileId, alt, size) => (
      <PortalQuizImage quizId={quizId} fileId={fileId} alt={alt} size={size} />
    ),
  };

  if (status.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Quiz" />
        <ErrorState message={status.message} />
      </div>
    );
  }

  if (status.kind === "submitted") {
    return (
      <div className="space-y-6">
        <PageHeader title={status.title ?? "Quiz"} />
        <Card className="text-center">
          <h2 className="font-display text-lg font-medium text-slate-900">Quiz submitted</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your result is being computed. Check back here once your teacher publishes it.
          </p>
        </Card>
      </div>
    );
  }

  if (status.kind === "interstitial") {
    const { data } = status;
    const scheduled = data.availability === "SCHEDULED";
    const closed = data.availability === "CLOSED";
    const canStart = !scheduled && !closed;
    return (
      <div className="space-y-6">
        <PageHeader title={data.title} description={`${data.subjectName} · ${data.className}`} />
        <Card>
          {data.teacherName && <p className="text-sm text-slate-500">Set by {data.teacherName}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Questions</dt>
              <dd className="font-medium text-slate-900">{data.questionCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Total points</dt>
              <dd className="font-medium text-slate-900">{data.totalPoints}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Time limit</dt>
              <dd className="font-medium text-slate-900">
                {data.timed ? `${data.durationMinutes} minutes` : "Untimed"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Closes</dt>
              <dd className="font-medium text-slate-900">{formatInstant(data.closesAt)}</dd>
            </div>
          </dl>

          {scheduled && (
            <Alert variant="info" className="mt-4">
              This quiz is not open yet.
            </Alert>
          )}
          {closed && (
            <Alert variant="warning" className="mt-4">
              This quiz has closed.
            </Alert>
          )}

          <Button className="mt-6 w-full" size="lg" onClick={handleStart} loading={starting} disabled={!canStart}>
            {data.attemptState === "IN_PROGRESS" ? "Resume quiz" : "Start quiz"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <QuizRunner
      initialAttempt={status.attempt}
      transport={transport}
      onSubmitted={() => setStatus({ kind: "submitted", title: null })}
      onError={(error) => setStatus({ kind: "error", message: getErrorMessage(error, "Failed to load this quiz") })}
    />
  );
}
