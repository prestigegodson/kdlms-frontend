import { apiFetch } from "@/api/client";
import type { QuestionType } from "@/api/takeHomeQuizzes";

/**
 * The unauthenticated take-home quiz surface (Phase 20D) - mirrors backend
 * `takehomequiz.application.port.in.TakeTakeHomeQuizUseCase`. Deliberately
 * distinct types from `api/takeHomeQuizzes.ts`'s staff-facing
 * `TakeHomeQuizQuestionView`/`TakeHomeQuizOptionView` - those carry
 * `correct`/answer-key text for the builder, which must never reach this
 * anonymous surface's network tab.
 */
export type AttemptState = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
export type QuizAvailability = "SCHEDULED" | "OPEN" | "CLOSED";

export interface PublicOptionView {
  id: string;
  position: number;
  /** Sanitized HTML, the same contract as `PublicQuestionView.prompt` (Phase 20J: including images). */
  label: string;
}

export interface PublicQuestionView {
  id: string;
  position: number;
  questionType: QuestionType;
  /** Sanitized HTML - see backend `takehomequiz.domain.QuizRichText`. Render with `RichContent`, never as plain text. */
  prompt: string;
  points: number;
  options: PublicOptionView[];
}

export interface PublicAnswerView {
  selectedOptionIds: string[];
  textAnswer: string | null;
}

/** Mirrors backend `TakeTakeHomeQuizUseCase.QuizInterstitialView` - shown before Start is pressed. */
export interface QuizInterstitialView {
  schoolName: string;
  schoolLogoDataUri: string | null;
  quizTitle: string;
  subjectName: string;
  className: string;
  teacherName: string;
  studentFirstName: string;
  questionCount: number;
  totalPoints: number;
  timed: boolean;
  durationMinutes: number | null;
  closesAt: string;
  availability: QuizAvailability | null;
  attemptState: AttemptState;
  serverTime: string;
}

/** Mirrors backend `TakeTakeHomeQuizUseCase.QuizAttemptView` - returned by Start/resume/autosave. */
export interface QuizAttemptView {
  questions: PublicQuestionView[];
  answers: Record<string, PublicAnswerView>;
  deadlineAt: string | null;
  serverTime: string;
}

export interface AnswerCommand {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer: string | null;
}

export interface SubmitConfirmationView {
  alreadySubmitted: boolean;
  serverTime: string;
}

function base(token: string): string {
  return `/api/v1/public/take-home-quiz/${encodeURIComponent(token)}`;
}

/**
 * The `<img src>` for one image embedded in a question's sanitized `prompt`
 * or option `label` HTML (Phase 20J) - mirrors backend
 * `PublicTakeHomeQuizController.questionImage`. No fetch wrapper needed: the
 * endpoint takes no Authorization header (this is the anonymous surface)
 * and is safe to reference directly, browser-cached per its own
 * `Cache-Control` response header.
 */
export function publicQuestionImageUrl(token: string, fileId: string): string {
  return `${base(token)}/images/${encodeURIComponent(fileId)}`;
}

export function resolveTakeHomeQuiz(token: string): Promise<QuizInterstitialView> {
  return apiFetch<QuizInterstitialView>(base(token), { authenticated: false });
}

export function startTakeHomeQuiz(token: string): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${base(token)}/start`, { method: "POST", authenticated: false });
}

export function resumeTakeHomeQuizAttempt(token: string): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${base(token)}/attempt`, { authenticated: false });
}

export function saveTakeHomeQuizAnswers(token: string, answers: AnswerCommand[]): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${base(token)}/answers`, {
    method: "PUT",
    authenticated: false,
    body: JSON.stringify({ answers }),
  });
}

export function submitTakeHomeQuiz(token: string): Promise<SubmitConfirmationView> {
  return apiFetch<SubmitConfirmationView>(`${base(token)}/submit`, { method: "POST", authenticated: false });
}
