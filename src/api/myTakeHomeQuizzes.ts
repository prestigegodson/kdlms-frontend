import { apiFetch, apiFetchBlob } from "@/api/client";
import type {
  AnswerCommand,
  AttemptState,
  QuizAttemptView,
  QuizAvailability,
  QuizReviewView,
  SubmitConfirmationView,
} from "@/api/publicTakeHomeQuiz";
import type { QuizType } from "@/api/takeHomeQuizzes";
import type { Page } from "@/api/types";

/**
 * The authenticated STUDENT portal's take-home quiz surface (Phase 35I.3) - the twin of
 * `api/publicTakeHomeQuiz.ts`'s anonymous token path, for a student who holds a portal login.
 * Reuses `publicTakeHomeQuiz.ts`'s already answer-key-free `QuizAttemptView`/`AnswerCommand`/
 * `SubmitConfirmationView`/`AttemptState`/`QuizAvailability`/`QuizReviewView` types (Phase 20K) -
 * the backend serves byte-identical shapes on both paths.
 */
const ME_BASE = "/api/v1/me/take-home-quizzes";

/** score is null until the caller's own submission is reviewable (the quiz's `revealResultsOnSubmit` opt-in, or `resultsPublished`) - never zero, which would misread as "scored zero". */
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
  /** True only once the quiz's own `revealResultsOnSubmit` is on and the caller has already submitted - see `getMyQuizReview`. */
  revealResults: boolean;
  serverTime: string;
}

/** The caller's own class's quizzes for the school's current term only - an empty page when no term is marked current. */
export function listMyTakeHomeQuizzes(page = 0, size = 20): Promise<Page<MyTakeHomeQuizSummaryView>> {
  return apiFetch<Page<MyTakeHomeQuizSummaryView>>(`${ME_BASE}?page=${page}&size=${size}`);
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

/** The caller's own score and per-question review - 404s unless `revealResults` is true. */
export function getMyQuizReview(quizId: string): Promise<QuizReviewView> {
  return apiFetch<QuizReviewView>(`${ME_BASE}/${quizId}/review`);
}

/** Authenticated - unlike the public path's `publicQuestionImageUrl`, this endpoint needs a Bearer header, so it's a blob fetch rather than a bare `<img src>`. */
export function downloadMyTakeHomeQuizImage(quizId: string, fileId: string): Promise<Blob> {
  return apiFetchBlob(`${ME_BASE}/${quizId}/images/${fileId}`);
}
