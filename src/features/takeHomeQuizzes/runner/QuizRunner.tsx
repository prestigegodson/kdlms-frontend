import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import type {
  AnswerCommand,
  PublicAnswerView,
  QuizAttemptView,
  SubmitConfirmationView,
} from "@/api/publicTakeHomeQuiz";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { QuestionCard } from "@/features/takeHomeQuizzes/public/components/QuestionCard";
import { QuestionNavStrip } from "@/features/takeHomeQuizzes/public/components/QuestionNavStrip";
import { QuizTimer } from "@/features/takeHomeQuizzes/public/components/QuizTimer";
import {
  type SaveStatus,
  SaveStatusIndicator,
} from "@/features/takeHomeQuizzes/public/components/SaveStatusIndicator";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";
import { StimulusBody, StimulusPanel } from "@/features/takeHomeQuizzes/runner/StimulusPanel";
import { stimulusGroups } from "@/features/takeHomeQuizzes/runner/stimulusGroups";

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
    localStorage.setItem(
      bufferStorageKey(bufferKey),
      JSON.stringify({ answers, updatedAt: Date.now() }),
    );
  } catch {
    // Private browsing / quota failures - the buffer is a convenience, never load-bearing.
  }
}

function clearBuffer(bufferKey: string) {
  try {
    localStorage.removeItem(bufferStorageKey(bufferKey));
    localStorage.removeItem(collapsedStorageKey(bufferKey));
  } catch {
    // Same as above.
  }
}

/** Which passages the student has hidden - a per-device reading preference, never sent anywhere. */
function collapsedStorageKey(bufferKey: string): string {
  return `thq:${bufferKey}:collapsed`;
}

function readCollapsed(bufferKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(collapsedStorageKey(bufferKey));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeCollapsed(bufferKey: string, collapsed: Set<string>) {
  try {
    localStorage.setItem(collapsedStorageKey(bufferKey), JSON.stringify([...collapsed]));
  } catch {
    // A convenience only.
  }
}

export interface QuizRunnerProps {
  /** The already-started attempt (from the caller's own `start()` call) - this component never itself calls start/resolve. */
  initialAttempt: QuizAttemptView;
  /** Everything network/auth-specific - see `quizTransport.ts`. */
  transport: QuizTransport;
  /** Called once submit (or auto-submit on timer expiry) succeeds, with the server's own confirmation (`revealResults` tells the caller whether to show the score/review right away). */
  onSubmitted: (confirmation: SubmitConfirmationView) => void;
  /** Called when submit fails outright, or the final save before it does (an autosave failure is silently retried) - the caller renders its own error chrome. */
  onError: (error: unknown) => void;
  /**
   * Where the sticky Previous/Next bar docks below `lg`: the viewport's bottom edge (the full-page
   * token path, a modal) or just above the portal's `MobileTabBar`.
   */
  dock?: "viewport" | "tabbar";
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
export function QuizRunner({ initialAttempt, transport, onSubmitted, onError, dock = "viewport" }: QuizRunnerProps) {
  const { bufferKey, saveAnswers, submit, renderQuestionImage } = transport;
  const [attempt, setAttempt] = useState(initialAttempt);
  const [answers, setAnswers] = useState<AnswersState>(() => {
    const buffered = readBuffer(bufferKey);
    return buffered ? { ...initialAttempt.answers, ...buffered } : initialAttempt.answers;
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Every passage starts open - the first time a student reaches it they see it - and stays the way
  // they last left it, across questions and reloads.
  const [collapsedStimuli, setCollapsedStimuli] = useState<Set<string>>(() => readCollapsed(bufferKey));
  const [readerOpen, setReaderOpen] = useState(false);
  const [scrollPositions] = useState(() => new Map<string, number>());

  // An attempt's question set never changes, so neither does each question's type - what an
  // interactive answer is tagged with on save.
  const [questionTypes] = useState(
    () => new Map(initialAttempt.questions.map((question) => [question.id, question.questionType])),
  );

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The latest answers not yet confirmed saved - null once the server has them.
  const pendingAnswersRef = useRef<AnswersState | null>(null);
  // The tail of the save chain: every save waits for the previous one, so an older full-state
  // save can never land after a newer one, and submit can wait for the last one to finish.
  const inFlightSaveRef = useRef<Promise<void>>(Promise.resolve());

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
    (toSave: AnswersState): Promise<void> => {
      if (Object.keys(toSave).length === 0) {
        if (pendingAnswersRef.current === toSave) {
          pendingAnswersRef.current = null;
        }
        return inFlightSaveRef.current;
      }
      setSaveStatus("saving");
      const commands: AnswerCommand[] = Object.entries(toSave).map(([questionId, answer]) => ({
        questionId,
        selectedOptionIds: answer.selectedOptionIds ?? [],
        textAnswer: answer.textAnswer ?? null,
        interaction:
          answer.interaction && questionTypes.has(questionId)
            ? { type: questionTypes.get(questionId)!, response: answer.interaction }
            : null,
      }));
      const save = inFlightSaveRef.current
        .catch(() => undefined)
        .then(() => saveAnswers(commands))
        .then(
          (updated) => {
            setAttempt(updated);
            // Only a save of the latest state settles the buffer - a newer edit may already be
            // waiting behind this one.
            if (pendingAnswersRef.current === null || pendingAnswersRef.current === toSave) {
              pendingAnswersRef.current = null;
              clearBuffer(bufferKey);
            }
            setSaveStatus("saved");
          },
          (error: unknown) => {
            // The buffer already holds this exact state - a failed save is silently retried
            // on the next edit or flush; nothing typed is lost either way.
            setSaveStatus(navigator.onLine ? "saved" : "offline");
            throw error;
          },
        );
      inFlightSaveRef.current = save;
      return save;
    },
    [bufferKey, questionTypes, saveAnswers],
  );

  // Flush any locally-buffered edits from a previous, interrupted session once, on mount - the
  // "resuming on another device / after a dropped connection" case. Deferred to a microtask so
  // this effect never calls setState synchronously from its own body (react-hooks/set-state-in-effect).
  useEffect(() => {
    const buffered = readBuffer(bufferKey);
    if (buffered) {
      pendingAnswersRef.current = buffered;
      queueMicrotask(() => void flushAnswers(buffered).catch(() => undefined));
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
          void flushAnswers(pendingAnswersRef.current).catch(() => undefined);
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

  /** Saves any unsaved edits now; resolves once every save so far has reached the server. */
  function flushPending(): Promise<void> {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    return pendingAnswersRef.current
      ? flushAnswers(pendingAnswersRef.current)
      : inFlightSaveRef.current;
  }

  function handleBlurFlush() {
    void flushPending().catch(() => undefined);
  }

  const handleSubmit = useCallback(() => {
    if (submitting) {
      return;
    }
    setConfirmOpen(false);
    setSubmitting(true);
    // Submit sends no answers - the server scores what it has stored - so the last edit must be
    // saved first, or it is lost (e.g. the final item dropped just before Submit).
    flushPending()
      .then(() => submit())
      .then((confirmation) => {
        clearBuffer(bufferKey);
        onSubmitted(confirmation);
      })
      .catch((error: unknown) => onError(error))
      .finally(() => setSubmitting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flushPending reads refs only
  }, [bufferKey, submit, submitting, onSubmitted, onError]);

  const questions = attempt.questions;
  const answeredIndexes = useMemo(() => {
    const indexes = new Set<number>();
    questions.forEach((question, index) => {
      const answer = answers[question.id];
      const hasSelection = (answer?.selectedOptionIds?.length ?? 0) > 0;
      const hasText = !!answer?.textAnswer?.trim();
      if (hasSelection || hasText || !!answer?.interaction) {
        indexes.add(index);
      }
    });
    return indexes;
  }, [questions, answers]);

  const unansweredIndexes = useMemo(
    () =>
      Array.from({ length: questions.length }, (_, index) => index).filter(
        (index) => !answeredIndexes.has(index),
      ),
    [questions.length, answeredIndexes],
  );

  const currentQuestion = questions[currentIndex];
  const groups = useMemo(() => stimulusGroups(questions, attempt.stimuli), [questions, attempt.stimuli]);
  const currentGroup = currentQuestion?.stimulusId ? groups.get(currentQuestion.stimulusId) : undefined;
  const currentCollapsed = currentGroup ? collapsedStimuli.has(currentGroup.stimulus.id) : false;
  // IELTS-style split view from `lg` up: the passage on the left, the question on the right.
  const split = currentGroup?.stimulus.kind === "PASSAGE" && !currentCollapsed;
  const renderStimulusImage = (fileId: string, alt: string) => renderQuestionImage(fileId, alt, "prompt");

  function toggleStimulus(stimulusId: string) {
    setCollapsedStimuli((current) => {
      const next = new Set(current);
      if (next.has(stimulusId)) next.delete(stimulusId);
      else next.add(stimulusId);
      writeCollapsed(bufferKey, next);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SaveStatusIndicator status={online ? saveStatus : "offline"} />
        <QuizTimer
          deadlineAt={attempt.deadlineAt}
          serverTime={attempt.serverTime}
          onExpire={handleSubmit}
        />
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
          <span className="font-display font-semibold text-slate-900">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-slate-500">{answeredIndexes.size} answered</span>
        </div>
        <div
          role="progressbar"
          aria-label="Questions answered"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredIndexes.size}
          className="h-2.5 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
            style={{ width: `${questions.length === 0 ? 0 : (answeredIndexes.size / questions.length) * 100}%` }}
          />
        </div>
        {questions.length > 0 && unansweredIndexes.length === 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-green-600">
            <PartyPopper className="h-4 w-4" aria-hidden="true" />
            All done! Ready to submit.
          </p>
        )}
      </div>

      <div className="mb-4">
        <QuestionNavStrip
          count={questions.length}
          currentIndex={currentIndex}
          answeredIndexes={answeredIndexes}
          onSelect={setCurrentIndex}
          groups={[...groups.values()].map((group) => ({ first: group.first, last: group.last, name: group.name }))}
        />
      </div>

      {currentQuestion && (
        <div
          data-testid="question-layout"
          className={split ? "lg:grid lg:grid-cols-2 lg:items-start lg:gap-6" : undefined}
        >
          {currentGroup && (
            <div
              className={`mb-4 ${split ? "lg:sticky lg:top-4 lg:mb-0" : ""}`}
              data-testid="stimulus-column"
            >
              <StimulusPanel
                key={currentGroup.stimulus.id}
                stimulus={currentGroup.stimulus}
                name={currentGroup.name}
                rangeLabel={currentGroup.rangeLabel}
                collapsed={currentCollapsed}
                onToggle={() => toggleStimulus(currentGroup.stimulus.id)}
                onExpand={() => setReaderOpen(true)}
                renderImage={renderStimulusImage}
                scrollPositions={scrollPositions}
              />
            </div>
          )}
          <div onBlur={handleBlurFlush} className="min-w-0">
            <QuestionCard
              question={currentQuestion}
              answer={answers[currentQuestion.id]}
              answered={answeredIndexes.has(currentIndex)}
              onChange={(answer) => handleAnswerChange(currentQuestion.id, answer)}
              renderImage={renderQuestionImage}
              stackOptions={currentGroup?.stimulus.kind === "PASSAGE"}
            />
          </div>
        </div>
      )}

      {/* Docked to the bottom so a long passage above the question never pushes navigation off-screen. */}
      <div
        className={`sticky z-10 mt-6 flex items-center justify-between gap-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
          dock === "tabbar" ? "bottom-tabbar-safe lg:bottom-0" : "bottom-0"
        }`}
        data-testid="quiz-action-bar"
      >
        <Button
          variant="secondary"
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {/* Room for the Passage button on a narrow phone - the label stays for screen readers. */}
          <span className={currentGroup?.stimulus.kind === "PASSAGE" ? "max-sm:sr-only" : undefined}>Previous</span>
        </Button>
        {currentGroup?.stimulus.kind === "PASSAGE" && (
          <Button variant="ghost" className="lg:hidden" onClick={() => setReaderOpen(true)}>
            <BookOpen className="h-4 w-4" aria-hidden="true" /> Passage
          </Button>
        )}
        {currentIndex < questions.length - 1 ? (
          <Button
            onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
          >
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button onClick={() => setConfirmOpen(true)} loading={submitting}>
            Submit quiz
          </Button>
        )}
      </div>

      {readerOpen && currentGroup && (
        <Modal
          open
          onClose={() => setReaderOpen(false)}
          title={currentGroup.stimulus.title?.trim() || currentGroup.name}
          size="xxl"
          fullScreenOnMobile
        >
          <p className="mb-3 text-sm font-medium text-slate-500">{currentGroup.rangeLabel}</p>
          <StimulusBody stimulus={currentGroup.stimulus} renderImage={renderStimulusImage} />
          <div className="sticky bottom-0 mt-6 bg-white pt-3">
            <Button className="w-full" onClick={() => setReaderOpen(false)}>
              Back to question {currentIndex + 1}
            </Button>
          </div>
        </Modal>
      )}

      {confirmOpen && (
        <ConfirmDialog
          title="Submit quiz?"
          confirmLabel="Submit quiz"
          onConfirm={async () => handleSubmit()}
          onClose={() => setConfirmOpen(false)}
          message={
            unansweredIndexes.length === 0 ? (
              <p>
                You&apos;ve answered all {questions.length} question
                {questions.length === 1 ? "" : "s"}. Once submitted, you can&apos;t change your
                answers.
              </p>
            ) : (
              <div className="space-y-3">
                <Alert
                  variant="warning"
                  title={`You have ${unansweredIndexes.length} unanswered question${unansweredIndexes.length === 1 ? "" : "s"}`}
                >
                  <div className="flex flex-wrap gap-2 pt-1">
                    {unansweredIndexes.map((index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setConfirmOpen(false);
                          setCurrentIndex(index);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-white text-sm font-medium text-amber-800 hover:bg-amber-100"
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </Alert>
                <p>
                  Unanswered questions will score zero. Once submitted, you can&apos;t change your
                  answers.
                </p>
              </div>
            )
          }
        />
      )}
    </div>
  );
}
