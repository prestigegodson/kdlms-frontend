import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AnswerCommand, PublicAnswerView, QuizAttemptView } from "@/api/publicTakeHomeQuiz";
import { Button } from "@/components/ui/Button";
import { QuestionCard } from "@/features/takeHomeQuizzes/public/components/QuestionCard";
import { QuestionNavStrip } from "@/features/takeHomeQuizzes/public/components/QuestionNavStrip";
import { QuizTimer } from "@/features/takeHomeQuizzes/public/components/QuizTimer";
import {
  type SaveStatus,
  SaveStatusIndicator,
} from "@/features/takeHomeQuizzes/public/components/SaveStatusIndicator";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";

type AnswersState = Record<string, PublicAnswerView>;

const AUTOSAVE_DEBOUNCE_MS = 1500;

function bufferStorageKey(bufferKey: string): string {
  return `thq:${bufferKey}`;
}

function readBuffer(bufferKey: string): AnswersState | null {
  try {
    const raw = localStorage.getItem(bufferStorageKey(bufferKey));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { answers: AnswersState };
    return parsed.answers ?? null;
  } catch {
    return null;
  }
}

function writeBuffer(bufferKey: string, answers: AnswersState) {
  try {
    localStorage.setItem(bufferStorageKey(bufferKey), JSON.stringify({ answers, updatedAt: Date.now() }));
  } catch {
    // Private browsing / quota failures - the buffer is a convenience, never load-bearing.
  }
}

function clearBuffer(bufferKey: string) {
  try {
    localStorage.removeItem(bufferStorageKey(bufferKey));
  } catch {
    // Same as above.
  }
}

export interface QuizRunnerProps {
  /** The already-started attempt (from the caller's own `start()` call) - this component never itself calls start/resolve. */
  initialAttempt: QuizAttemptView;
  /** Everything network/auth-specific - see `quizTransport.ts`. */
  transport: QuizTransport;
  /** Called once submit (or auto-submit on timer expiry) succeeds. */
  onSubmitted: () => void;
  /** Called when submit fails outright (not a save failure, which is silently retried) - the caller renders its own error chrome. */
  onError: (error: unknown) => void;
}

/**
 * The shared "attempt in progress" state machine (Phase 35I) - extracted out of
 * `TakeHomeQuizPublicPage` so the anonymous token path and the authenticated portal path
 * (`StudentQuizPage`) share one implementation of the timer, the autosave/localStorage
 * write-behind buffer, question navigation, and submit - the frontend mirror of the backend's
 * `TakeHomeQuizAttemptRunner` extraction. Deliberately does not own the interstitial or
 * submitted/error screens - those differ in chrome (full-viewport vs. portal shell) and stay with
 * each caller; this component starts already in progress, given `initialAttempt`.
 */
export function QuizRunner({ initialAttempt, transport, onSubmitted, onError }: QuizRunnerProps) {
  const { bufferKey, saveAnswers, submit, renderQuestionImage } = transport;
  const [attempt, setAttempt] = useState(initialAttempt);
  const [answers, setAnswers] = useState<AnswersState>(() => {
    const buffered = readBuffer(bufferKey);
    return buffered ? { ...initialAttempt.answers, ...buffered } : initialAttempt.answers;
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [submitting, setSubmitting] = useState(false);

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
      saveAnswers(commands)
        .then((updated) => {
          setAttempt(updated);
          clearBuffer(bufferKey);
          setSaveStatus("saved");
        })
        .catch(() => {
          // The buffer already holds this exact state - a failed save is silently retried
          // on the next edit or flush; nothing typed is lost either way.
          setSaveStatus(navigator.onLine ? "saved" : "offline");
        });
    },
    [bufferKey, saveAnswers],
  );

  // Flush any locally-buffered edits from a previous, interrupted session once, on mount - the
  // "resuming on another device / after a dropped connection" case. Deferred to a microtask so
  // this effect never calls setState synchronously from its own body (react-hooks/set-state-in-effect).
  useEffect(() => {
    const buffered = readBuffer(bufferKey);
    if (buffered) {
      queueMicrotask(() => flushAnswers(buffered));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  const scheduleSave = useCallback(
    (next: AnswersState) => {
      pendingAnswersRef.current = next;
      writeBuffer(bufferKey, next);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        if (pendingAnswersRef.current) {
          flushAnswers(pendingAnswersRef.current);
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [bufferKey, flushAnswers],
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

  const handleSubmit = useCallback(() => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    handleBlurFlush();
    submit()
      .then(() => {
        clearBuffer(bufferKey);
        onSubmitted();
      })
      .catch((error: unknown) => onError(error))
      .finally(() => setSubmitting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleBlurFlush reads refs only
  }, [bufferKey, submit, submitting, onSubmitted, onError]);

  const questions = attempt.questions;
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

  const currentQuestion = questions[currentIndex];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SaveStatusIndicator status={online ? saveStatus : "offline"} />
        <QuizTimer deadlineAt={attempt.deadlineAt} serverTime={attempt.serverTime} onExpire={handleSubmit} />
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
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            answered={answeredIndexes.has(currentIndex)}
            onChange={(answer) => handleAnswerChange(currentQuestion.id, answer)}
            renderImage={renderQuestionImage}
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
