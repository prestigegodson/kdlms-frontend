import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type ClassQuizReader,
  getLearnerClassQuiz,
  getMemberClassQuizReview,
  saveLearnerClassQuizAnswers,
  startLearnerClassQuiz,
  submitLearnerClassQuiz,
} from "@/api/classTakeHomeQuizzes";
import type { MyQuizInterstitialView } from "@/api/myTakeHomeQuizzes";
import type { QuizAttemptView } from "@/api/publicTakeHomeQuiz";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { ClassQuizImage } from "@/features/takeHomeQuizzes/classMember/ClassQuizImage";
import { QuizResultReveal } from "@/features/takeHomeQuizzes/components/QuizResultReveal";
import { QuizRunner } from "@/features/takeHomeQuizzes/runner/QuizRunner";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";
import { formatInstant } from "@/utils/date";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "interstitial"; data: MyQuizInterstitialView }
  | { kind: "inProgress"; attempt: QuizAttemptView }
  | { kind: "submitted"; title: string | null; revealResults: boolean };

/**
 * A learner taking one of their tutor's class quizzes (creators Phase C13) at
 * `/learner/quizzes/:classId/:quizId` - the student portal's `StudentQuizPage` against the learner's
 * class endpoints: the same interstitial, the shared `QuizRunner` (timer, autosave, buffer, submit)
 * through its own `QuizTransport`, and `QuizResultReveal` once the score is released.
 */
export function LearnerClassQuizPage() {
  const { classId = "", quizId = "" } = useParams<{ classId: string; quizId: string }>();
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [starting, setStarting] = useState(false);
  const reader: ClassQuizReader = useMemo(() => ({ classId }), [classId]);

  useEffect(() => {
    let cancelled = false;
    getLearnerClassQuiz(classId, quizId)
      .then((data) => {
        if (cancelled) return;
        setStatus(
          data.attemptState === "SUBMITTED"
            ? { kind: "submitted", title: data.title, revealResults: data.revealResults }
            : { kind: "interstitial", data },
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus({ kind: "error", message: getErrorMessage(error, "Failed to load this quiz") });
      });
    return () => {
      cancelled = true;
    };
  }, [classId, quizId]);

  function handleStart() {
    setStarting(true);
    startLearnerClassQuiz(classId, quizId)
      .then((attempt) => setStatus({ kind: "inProgress", attempt }))
      .catch((error: unknown) => setStatus({ kind: "error", message: getErrorMessage(error, "Failed to start this quiz") }))
      .finally(() => setStarting(false));
  }

  const transport: QuizTransport = {
    bufferKey: `learner:${quizId}`,
    saveAnswers: (answers) => saveLearnerClassQuizAnswers(classId, quizId, answers),
    submit: () => submitLearnerClassQuiz(classId, quizId),
    renderQuestionImage: (fileId, alt, size) => (
      <ClassQuizImage reader={reader} quizId={quizId} fileId={fileId} alt={alt} size={size} />
    ),
  };

  const loadReview = useCallback(() => getMemberClassQuizReview(reader, quizId), [reader, quizId]);
  const renderReviewImage = useCallback(
    (fileId: string, alt: string) => <ClassQuizImage reader={reader} quizId={quizId} fileId={fileId} alt={alt} size="option" />,
    [reader, quizId],
  );

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
        <PageHeader title="Quiz" backTo={`/learner/quizzes?classId=${classId}`} />
        <ErrorState message={status.message} />
      </div>
    );
  }

  if (status.kind === "submitted") {
    return (
      <div className="space-y-6">
        <PageHeader title={status.title ?? "Quiz"} backTo={`/learner/quizzes?classId=${classId}`} />
        {status.revealResults ? (
          <Card>
            <QuizResultReveal load={loadReview} renderImage={renderReviewImage} />
          </Card>
        ) : (
          <Card className="text-center">
            <h2 className="font-display text-lg font-medium text-slate-900">Quiz submitted</h2>
            <p className="mt-2 text-sm text-slate-600">
              Your answers are in. Check back here once your tutor releases the results.
            </p>
          </Card>
        )}
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
        <PageHeader
          title={data.title}
          description={data.subjectName ? `${data.subjectName} · ${data.className}` : data.className}
          backTo={`/learner/quizzes?classId=${classId}`}
        />
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
              <dd className="font-medium text-slate-900">{data.timed ? `${data.durationMinutes} minutes` : "Untimed"}</dd>
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
      onSubmitted={(confirmation) => setStatus({ kind: "submitted", title: null, revealResults: confirmation.revealResults })}
      onError={(error) => setStatus({ kind: "error", message: getErrorMessage(error, "Failed to load this quiz") })}
    />
  );
}
