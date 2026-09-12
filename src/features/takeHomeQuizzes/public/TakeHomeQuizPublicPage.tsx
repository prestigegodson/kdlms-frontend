import { ChevronLeft, ChevronRight, LinkIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  type AnswerCommand,
  type PublicAnswerView,
  type QuizAttemptView,
  type QuizInterstitialView,
  resolveTakeHomeQuiz,
  saveTakeHomeQuizAnswers,
  startTakeHomeQuiz,
  submitTakeHomeQuiz,
} from "@/api/publicTakeHomeQuiz";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { QuestionCard } from "@/features/takeHomeQuizzes/public/components/QuestionCard";
import { QuestionNavStrip } from "@/features/takeHomeQuizzes/public/components/QuestionNavStrip";
import { QuizInterstitial } from "@/features/takeHomeQuizzes/public/components/QuizInterstitial";
import { QuizTimer } from "@/features/takeHomeQuizzes/public/components/QuizTimer";
import {
  type SaveStatus,
  SaveStatusIndicator,
} from "@/features/takeHomeQuizzes/public/components/SaveStatusIndicator";
import { SubmitConfirmation } from "@/features/takeHomeQuizzes/public/components/SubmitConfirmation";

type AnswersState = Record<string, PublicAnswerView>;

type Status =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "interstitial"; data: QuizInterstitialView }
  | { kind: "inProgress"; attempt: QuizAttemptView }
  | { kind: "submitted" }
  | { kind: "error"; message: string };

const AUTOSAVE_DEBOUNCE_MS = 1500;

function bufferKey(token: string): string {
  return `thq:${token}`;
}

function readBuffer(token: string): AnswersState | null {
  try {
    const raw = localStorage.getItem(bufferKey(token));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { answers: AnswersState };
    return parsed.answers ?? null;
  } catch {
    return null;
  }
}

function writeBuffer(token: string, answers: AnswersState) {
  try {
    localStorage.setItem(bufferKey(token), JSON.stringify({ answers, updatedAt: Date.now() }));
  } catch {
    // Private browsing / quota failures - the buffer is a convenience, never load-bearing.
  }
}

function clearBuffer(token: string) {
  try {
    localStorage.removeItem(bufferKey(token));
  } catch {
    // Same as above.
  }
}

/**
 * The unauthenticated take-home quiz page (Phase 20D) - see `quiz-module.md`'s
 * "Phase 20D — Taking and submitting". Follows `ResetPasswordPage`'s
 * precedent for a token-in-querystring public page: the token comes solely
 * from `?token=`, and a missing one renders an invalid-link state rather
 * than a form. Every API call passes `authenticated: false`
 * (`api/publicTakeHomeQuiz.ts`), so a signed-in teacher opening this link
 * gets the identical anonymous page everyone else does.
 */
export function TakeHomeQuizPublicPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<Status>(() => (token ? { kind: "loading" } : { kind: "invalid" }));
  const [answers, setAnswers] = useState<AnswersState>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingAnswersRef = useRef<AnswersState | null>(null);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    // No token to resolve - `status` was already initialized to "invalid" above, matching
    // ResetPasswordPage's precedent of checking this once, in render, rather than via an effect.
    if (!token) {
      return;
    }
    let cancelled = false;
    resolveTakeHomeQuiz(token)
      .then((data) => {
        if (cancelled) return;
        if (data.attemptState === "SUBMITTED") {
          setStatus({ kind: "submitted" });
        } else {
          setStatus({ kind: "interstitial", data });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(errorStatus(error));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const flushAnswers = useCallback(
    (toSave: AnswersState) => {
      if (Object.keys(toSave).length === 0) {
        return;
      }
      setSaveStatus("saving");
      const commands: AnswerCommand[] = Object.entries(toSave).map(([questionId, answer]) => ({
        questionId,
        selectedOptionIds: answer.selectedOptionIds,
        textAnswer: answer.textAnswer,
      }));
      saveTakeHomeQuizAnswers(token, commands)
        .then(() => {
          clearBuffer(token);
          setSaveStatus("saved");
        })
        .catch(() => {
          // The buffer already holds this exact state - a failed save is silently retried
          // on the next edit or flush; nothing typed is lost either way.
          setSaveStatus(navigator.onLine ? "saved" : "offline");
        });
    },
    [token],
  );

  const scheduleSave = useCallback(
    (next: AnswersState) => {
      pendingAnswersRef.current = next;
      writeBuffer(token, next);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        if (pendingAnswersRef.current) {
          flushAnswers(pendingAnswersRef.current);
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [token, flushAnswers],
  );

  function handleAnswerChange(questionId: string, answer: PublicAnswerView) {
    setAnswers((current) => {
      const next = { ...current, [questionId]: answer };
      scheduleSave(next);
      return next;
    });
  }

  function handleBlurFlush() {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (pendingAnswersRef.current) {
      flushAnswers(pendingAnswersRef.current);
    }
  }

  const [starting, setStarting] = useState(false);

  function handleStart() {
    setStarting(true);
    startTakeHomeQuiz(token)
      .then((attempt) => {
        const buffered = readBuffer(token);
        const merged: AnswersState = buffered ? { ...attempt.answers, ...buffered } : attempt.answers;
        setAnswers(merged);
        setStatus({ kind: "inProgress", attempt });
        if (buffered) {
          flushAnswers(merged);
        }
      })
      .catch((error: unknown) => setStatus(errorStatus(error)))
      .finally(() => setStarting(false));
  }

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(() => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    handleBlurFlush();
    submitTakeHomeQuiz(token)
      .then(() => {
        clearBuffer(token);
        setStatus({ kind: "submitted" });
      })
      .catch((error: unknown) => setStatus(errorStatus(error)))
      .finally(() => setSubmitting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleBlurFlush reads refs only
  }, [token, submitting]);

  const questions = useMemo(
    () => (status.kind === "inProgress" ? status.attempt.questions : []),
    [status],
  );
  const answeredIndexes = useMemo(() => {
    const indexes = new Set<number>();
    questions.forEach((question, index) => {
      const answer = answers[question.id];
      const hasSelection = (answer?.selectedOptionIds.length ?? 0) > 0;
      const hasText = !!answer?.textAnswer?.trim();
      if (hasSelection || hasText) {
        indexes.add(index);
      }
    });
    return indexes;
  }, [questions, answers]);

  if (status.kind === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  if (status.kind === "invalid") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <EmptyState
          icon={LinkIcon}
          title="Link not found"
          description="This quiz link is invalid or incomplete. Check the link your school sent and try again."
        />
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <Alert variant="error">{status.message}</Alert>
      </div>
    );
  }

  if (status.kind === "submitted") {
    return <SubmitConfirmation />;
  }

  if (status.kind === "interstitial") {
    return <QuizInterstitial data={status.data} starting={starting} onStart={handleStart} />;
  }

  const attempt = status.kind === "inProgress" ? status.attempt : null;
  const currentQuestion = questions[currentIndex];

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-6 pb-28">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SaveStatusIndicator status={online ? saveStatus : "offline"} />
        {attempt && (
          <QuizTimer
            deadlineAt={attempt.deadlineAt}
            serverTime={attempt.serverTime}
            onExpire={handleSubmit}
          />
        )}
      </div>

      <div className="mb-4">
        <QuestionNavStrip
          count={questions.length}
          currentIndex={currentIndex}
          answeredIndexes={answeredIndexes}
          onSelect={setCurrentIndex}
        />
      </div>

      {currentQuestion && (
        <div onBlur={handleBlurFlush}>
          <QuestionCard
            token={token}
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            answered={answeredIndexes.has(currentIndex)}
            onChange={(answer) => handleAnswerChange(currentQuestion.id, answer)}
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
        </Button>
        {currentIndex < questions.length - 1 ? (
          <Button onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}>
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={submitting}>
            Submit quiz
          </Button>
        )}
      </div>
    </div>
  );
}

function errorStatus(error: unknown): Status {
  if (error instanceof ApiError) {
    if (error.problem?.type === "https://kdlms.com/problems/too-many-requests") {
      return { kind: "error", message: "Too many requests - please wait a moment and try again." };
    }
    if (error.status === 404) {
      return { kind: "invalid" };
    }
    return { kind: "error", message: error.message };
  }
  return { kind: "error", message: "Something went wrong. Please try again." };
}
