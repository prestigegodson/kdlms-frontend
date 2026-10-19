import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { downloadFile } from "@/api/files";
import type { PublicAnswerView, QuizAttemptView } from "@/api/publicTakeHomeQuiz";
import type { QuizThemeStyle } from "@/api/quizThemes";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { QuizReview } from "@/features/takeHomeQuizzes/components/QuizReview";
import type { EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";
import type { EditableStimulus } from "@/features/takeHomeQuizzes/editableStimulus";
import { isInteractive } from "@/features/takeHomeQuizzes/interactions/registry";
import {
  type PreviewQuiz,
  type PreviewResult,
  scorePreview,
  toPreviewQuestions,
} from "@/features/takeHomeQuizzes/preview/previewQuiz";
import { QuizRunner } from "@/features/takeHomeQuizzes/runner/QuizRunner";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";
import { QUIZ_IMAGE_SIZE_CLASS } from "@/features/takeHomeQuizzes/runner/quizImageSizes";
import { QuizThemeFrame } from "@/features/takeHomeQuizzes/theme/QuizThemeFrame";
import { STAFF_THEME_IMAGES } from "@/features/takeHomeQuizzes/theme/staffThemeImages";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { useParticipantNoun } from "@/components/ParticipantNoun";

export interface QuizPreviewModalProps {
  title: string;
  instructions: string;
  timed: boolean;
  durationMinutes: number | null;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  questions: EditableQuestion[];
  /** The editor's passages (Phase 20L), saved or not. */
  stimuli?: EditableStimulus[];
  /** The saved quiz's resolved look - null for the plain one. */
  theme: QuizThemeStyle | null;
  /** True when the editor's theme choice isn't saved yet, so the preview still wears the old one. */
  themeUnsaved?: boolean;
  onClose: () => void;
}

type Stage =
  | { kind: "intro" }
  | {
      kind: "running";
      quiz: PreviewQuiz;
      attempt: QuizAttemptView;
      bufferKey: string;
      /** The run's answers as last "saved" - in memory only. */
      saved: { answers: Record<string, PublicAnswerView> };
      transport: QuizTransport;
    }
  | { kind: "done"; result: PreviewResult };

function bufferStorageKey(bufferKey: string): string {
  return `thq:${bufferKey}`;
}

function clearPreviewBuffer(bufferKey: string) {
  try {
    localStorage.removeItem(bufferStorageKey(bufferKey));
  } catch {
    // Private browsing - nothing was buffered then either.
  }
}

function formatPoints(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function PreviewQuestionImage({ fileId, alt, size }: { fileId: string; alt: string; size: "prompt" | "option" }) {
  const url = useObjectUrl(fileId, downloadFile);
  return url ? <img src={url} alt={alt} className={QUIZ_IMAGE_SIZE_CLASS[size]} /> : null;
}

/**
 * A staff member's dry run of a quiz: the student's own `QuizRunner` (timer, navigation, submit),
 * driven by an in-memory transport so nothing is saved, then a client-scored review
 * (`preview/previewQuiz.ts`). Built from the editor's current questions, saved or not.
 */
export function QuizPreviewModal({
  title,
  instructions,
  timed,
  durationMinutes,
  shuffleQuestions,
  shuffleChoices,
  questions,
  stimuli = [],
  theme,
  themeUnsaved = false,
  onClose,
}: QuizPreviewModalProps) {
  const { singular, plural } = useParticipantNoun();
  const [stage, setStage] = useState<Stage>({ kind: "intro" });
  const bufferKeyRef = useRef<string | null>(null);

  // QuizRunner writes its localStorage buffer before every save - a preview's must never outlive it.
  useEffect(
    () => () => {
      if (bufferKeyRef.current) clearPreviewBuffer(bufferKeyRef.current);
    },
    [],
  );

  const playable = questions.filter((question) => question.interaction !== null || !isInteractive(question.questionType));
  const playableCount = playable.length;
  const totalPoints = playable.reduce((sum, question) => sum + (Number(question.points) || 0), 0);
  const minutes = timed && durationMinutes ? durationMinutes : null;

  function start() {
    if (bufferKeyRef.current) clearPreviewBuffer(bufferKeyRef.current);
    const bufferKey = `preview:${crypto.randomUUID()}`;
    bufferKeyRef.current = bufferKey;
    const quiz = toPreviewQuestions(questions, { shuffleQuestions, shuffleChoices }, Math.random, stimuli);
    const now = Date.now();
    const attempt: QuizAttemptView = {
      questions: quiz.questions,
      stimuli: quiz.stimuli,
      answers: {},
      deadlineAt: minutes ? new Date(now + minutes * 60_000).toISOString() : null,
      serverTime: new Date(now).toISOString(),
    };
    const saved: { answers: Record<string, PublicAnswerView> } = { answers: {} };
    setStage({ kind: "running", quiz, bufferKey, attempt, saved, transport: previewTransport(bufferKey, attempt, saved) });
  }

  function finish(run: Extract<Stage, { kind: "running" }>) {
    clearPreviewBuffer(run.bufferKey);
    setStage({
      kind: "done",
      result: scorePreview(run.quiz.questions, questions, run.saved.answers, run.quiz.stimuli),
    });
  }

  const renderReviewImage = (fileId: string, alt: string) => <AuthenticatedRichImage fileId={fileId} alt={alt} />;

  return (
    <Modal open onClose={onClose} title="Preview quiz" size="xxl">
      <div className="space-y-4">
        <Alert variant="info">
          <span className="flex items-center gap-2">
            <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
            This is a preview of what {plural} see. Answers aren&apos;t saved and nothing is recorded.
          </span>
        </Alert>
        {themeUnsaved && <p className="text-sm text-slate-500">Save the quiz to preview your new theme.</p>}

        <QuizThemeFrame theme={theme} images={STAFF_THEME_IMAGES}>
          {stage.kind === "intro" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-slate-900">{title || "Untitled quiz"}</h2>
                {instructions.trim() && (
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{instructions}</p>
                )}
              </div>
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                <div>
                  <dt className="inline">Questions: </dt>
                  <dd className="inline font-medium text-slate-900">{playableCount}</dd>
                </div>
                <div>
                  <dt className="inline">Total points: </dt>
                  <dd className="inline font-medium text-slate-900">{formatPoints(totalPoints)}</dd>
                </div>
                <div>
                  <dt className="inline">Time limit: </dt>
                  <dd className="inline font-medium text-slate-900">{minutes ? `${minutes} minutes` : "None"}</dd>
                </div>
              </dl>
              {playableCount < questions.length && (
                <Alert variant="warning">
                  {questions.length - playableCount} unfinished interactive question
                  {questions.length - playableCount === 1 ? " is" : "s are"} left out of the preview.
                </Alert>
              )}
              <Button onClick={start} disabled={playableCount === 0}>
                Start preview
              </Button>
            </div>
          )}

          {stage.kind === "running" && (
            <QuizRunner
              key={stage.bufferKey}
              initialAttempt={stage.attempt}
              transport={stage.transport}
              onSubmitted={() => finish(stage)}
              onError={() => finish(stage)}
            />
          )}

          {stage.kind === "done" && (
            <div className="space-y-4">
              <Alert variant={stage.result.score === stage.result.totalPoints ? "success" : "info"}>
                A {singular} with these answers would score {formatPoints(stage.result.score)} of{" "}
                {formatPoints(stage.result.totalPoints)} points.
              </Alert>
              <QuizReview
                questions={stage.result.questions}
                stimuli={stage.result.stimuli}
                renderImage={renderReviewImage}
                perspective="self"
              />
            </div>
          )}
        </QuizThemeFrame>

        <div className="flex flex-wrap justify-end gap-2">
          {stage.kind !== "intro" && (
            <Button variant="secondary" onClick={() => setStage({ kind: "intro" })}>
              Start over
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close preview
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Saves into memory only; submit just hands the run back for client-side scoring. */
function previewTransport(
  bufferKey: string,
  attempt: QuizAttemptView,
  saved: { answers: Record<string, PublicAnswerView> },
): QuizTransport {
  return {
    bufferKey,
    saveAnswers: async (commands) => {
      const next = { ...saved.answers };
      for (const command of commands) {
        next[command.questionId] = {
          selectedOptionIds: command.selectedOptionIds,
          textAnswer: command.textAnswer,
          interaction: command.interaction?.response ?? null,
        };
      }
      saved.answers = next;
      return { ...attempt, answers: next, serverTime: new Date().toISOString() };
    },
    submit: async () => ({ alreadySubmitted: false, revealResults: true, serverTime: new Date().toISOString() }),
    renderQuestionImage: (fileId, alt, size) => <PreviewQuestionImage fileId={fileId} alt={alt} size={size} />,
  };
}
