import { apiFetch, apiFetchBlob } from "@/api/client";
import type {
  AnswerCommand,
  AttemptState,
  QuizAttemptView,
  QuizAvailability,
  SubmitConfirmationView,
} from "@/api/publicTakeHomeQuiz";
import type { QuizType } from "@/api/takeHomeQuizzes";

/**
 * The authenticated STUDENT portal's take-home quiz surface (Phase 35I.3) - the twin of
 * `api/publicTakeHomeQuiz.ts`'s anonymous token path, for a student who holds a portal login.
 * Reuses `publicTakeHomeQuiz.ts`'s already answer-key-free `QuizAttemptView`/`AnswerCommand`/
 * `SubmitConfirmationView`/`AttemptState`/`QuizAvailability` types - the backend serves byte-
 * identical shapes on both paths.
 */
const ME_BASE = "/api/v1/me/take-home-quizzes";

/** score is null for a non-submitter or before results are published - never zero, which would misread as "scored zero". */
export interface MyTakeHomeQuizSummaryView {
  id: string;
  title: string;
  subjectName: string;
  quizType: QuizType;
  availability: QuizAvailability | null;
  attemptState: AttemptState;
  resultsPublished: boolean;
  score: number | null;
  totalPoints: number;
  closesAt: string;
}

export interface MyQuizInterstitialView {
  id: string;
  title: string;
  subjectName: string;
  className: string;
  teacherName: string;
  questionCount: number;
  totalPoints: number;
  timed: boolean;
  durationMinutes: number | null;
  opensAt: string;
  closesAt: string;
  availability: QuizAvailability | null;
  attemptState: AttemptState;
  serverTime: string;
}

export function listMyTakeHomeQuizzes(): Promise<MyTakeHomeQuizSummaryView[]> {
  return apiFetch<MyTakeHomeQuizSummaryView[]>(ME_BASE);
}

export function getMyTakeHomeQuiz(quizId: string): Promise<MyQuizInterstitialView> {
  return apiFetch<MyQuizInterstitialView>(`${ME_BASE}/${quizId}`);
}

export function startMyTakeHomeQuiz(quizId: string): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${ME_BASE}/${quizId}/start`, { method: "POST" });
}

export function resumeMyTakeHomeQuizAttempt(quizId: string): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${ME_BASE}/${quizId}/attempt`);
}

export function saveMyTakeHomeQuizAnswers(quizId: string, answers: AnswerCommand[]): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${ME_BASE}/${quizId}/answers`, {
    method: "PUT",
    body: JSON.stringify({ answers }),
  });
}

export function submitMyTakeHomeQuiz(quizId: string): Promise<SubmitConfirmationView> {
  return apiFetch<SubmitConfirmationView>(`${ME_BASE}/${quizId}/submit`, { method: "POST" });
}

/** Authenticated - unlike the public path's `publicQuestionImageUrl`, this endpoint needs a Bearer header, so it's a blob fetch rather than a bare `<img src>`. */
export function downloadMyTakeHomeQuizImage(quizId: string, fileId: string): Promise<Blob> {
  return apiFetchBlob(`${ME_BASE}/${quizId}/images/${fileId}`);
}
