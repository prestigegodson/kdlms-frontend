import { apiFetch, apiFetchBlob } from "@/api/client";
import type { MyQuizInterstitialView, MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import type {
  AnswerCommand,
  QuizAttemptView,
  QuizReviewView,
  SubmitConfirmationView,
} from "@/api/publicTakeHomeQuiz";
import type {
  AdjustScoreRequest,
  AnsweredQuestionView,
  PublishReadinessView,
  QuestionCommand,
  TakeHomeQuizActionsView,
  TakeHomeQuizAttemptState,
  TakeHomeQuizAvailability,
  TakeHomeQuizQuestionView,
  TakeHomeQuizStatus,
} from "@/api/takeHomeQuizzes";

/**
 * An education creator's quizzes for one virtual class, and a learner's/guardian's side of them
 * (creators Phase C13). The question set, score adjustment and review shapes are the school
 * module's own, so the shared editor, results and runner components work unchanged; a class quiz
 * is always NORMAL and has no class/subject/term, links or midterm write-back.
 */

// ---- creator ----

/** Mirrors backend `CreatorTakeHomeQuizzesUseCase.ClassQuizSummary`. */
export interface ClassQuizSummary {
  id: string;
  title: string;
  status: TakeHomeQuizStatus;
  availability: TakeHomeQuizAvailability | null;
  questionCount: number;
  totalPoints: number;
  opensAt: string;
  closesAt: string;
  updatedAt: string;
}

/** Mirrors backend `ClassQuizListView`. `writable` is false for an archived or over-limit class. */
export interface ClassQuizListView {
  classId: string;
  className: string;
  writable: boolean;
  quizzes: ClassQuizSummary[];
}

/** Mirrors backend `ClassQuizView` - the creator's full detail, answer keys included. */
export interface ClassQuizView {
  id: string;
  classId: string;
  className: string;
  title: string;
  instructions: string | null;
  status: TakeHomeQuizStatus;
  availability: TakeHomeQuizAvailability | null;
  timed: boolean;
  durationMinutes: number | null;
  opensAt: string;
  closesAt: string;
  revealResultsOnSubmit: boolean;
  totalPoints: number;
  hasSubmissions: boolean;
  questions: TakeHomeQuizQuestionView[];
  actions: TakeHomeQuizActionsView;
  updatedAt: string;
}

/** Mirrors backend `CreatorTakeHomeQuizController.SaveClassQuizRequest`. */
export interface SaveClassQuizRequest {
  title: string;
  instructions: string | null;
  timed: boolean;
  durationMinutes: number | null;
  opensAt: string;
  closesAt: string;
  revealResultsOnSubmit: boolean;
}

/** Mirrors backend `LearnerResultRowView` - `overLimit` means the plan's class size keeps them from taking it. */
export interface LearnerResultRowView {
  learnerId: string;
  fullName: string;
  overLimit: boolean;
  attemptState: TakeHomeQuizAttemptState;
  autoScore: number | null;
  adjustedScore: number | null;
  effectiveScore: number | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  resetCount: number;
}

export interface LearnerRef {
  learnerId: string;
  fullName: string;
}

/** Mirrors backend `ClassQuizResultsView`. */
export interface ClassQuizResultsView {
  status: TakeHomeQuizStatus;
  totalPoints: number;
  rosterSize: number;
  submittedCount: number;
  rows: LearnerResultRowView[];
  nonSubmitters: LearnerRef[];
}

/** Mirrors backend `LearnerAttemptDetailView`. */
export interface LearnerAttemptDetailView {
  learnerId: string;
  fullName: string;
  attemptState: TakeHomeQuizAttemptState;
  autoScore: number | null;
  adjustedScore: number | null;
  effectiveScore: number | null;
  adjustmentReason: string | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  questions: AnsweredQuestionView[];
}

/** Mirrors backend `ClassQuizPreflightView`. */
export interface ClassQuizPreflightView {
  canPublish: boolean;
  blockers: string[];
  nonSubmitters: LearnerRef[];
  submittedCount: number;
  rosterSize: number;
}

const creatorBase = (classId: string) => `/api/v1/virtual-classes/${classId}/take-home-quizzes`;

export function listClassQuizzes(classId: string): Promise<ClassQuizListView> {
  return apiFetch<ClassQuizListView>(creatorBase(classId));
}

export function getClassQuiz(classId: string, quizId: string): Promise<ClassQuizView> {
  return apiFetch<ClassQuizView>(`${creatorBase(classId)}/${quizId}`);
}

export function createClassQuiz(classId: string, request: SaveClassQuizRequest): Promise<ClassQuizView> {
  return apiFetch<ClassQuizView>(creatorBase(classId), { method: "POST", body: JSON.stringify(request) });
}

export function updateClassQuiz(
  classId: string,
  quizId: string,
  request: SaveClassQuizRequest,
): Promise<ClassQuizView> {
  return apiFetch<ClassQuizView>(`${creatorBase(classId)}/${quizId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function saveClassQuizQuestions(
  classId: string,
  quizId: string,
  questions: QuestionCommand[],
): Promise<ClassQuizView> {
  return apiFetch<ClassQuizView>(`${creatorBase(classId)}/${quizId}/questions`, {
    method: "PUT",
    body: JSON.stringify({ questions }),
  });
}

export function deleteClassQuiz(classId: string, quizId: string): Promise<void> {
  return apiFetch<void>(`${creatorBase(classId)}/${quizId}`, { method: "DELETE" });
}

export function getClassQuizValidation(classId: string, quizId: string): Promise<PublishReadinessView> {
  return apiFetch<PublishReadinessView>(`${creatorBase(classId)}/${quizId}/validation`);
}

export function publishClassQuiz(classId: string, quizId: string): Promise<ClassQuizView> {
  return apiFetch<ClassQuizView>(`${creatorBase(classId)}/${quizId}/publish`, { method: "POST" });
}

export function getClassQuizResults(classId: string, quizId: string): Promise<ClassQuizResultsView> {
  return apiFetch<ClassQuizResultsView>(`${creatorBase(classId)}/${quizId}/results`);
}

export function getLearnerQuizResult(
  classId: string,
  quizId: string,
  learnerId: string,
): Promise<LearnerAttemptDetailView> {
  return apiFetch<LearnerAttemptDetailView>(`${creatorBase(classId)}/${quizId}/results/${learnerId}`);
}

export function adjustLearnerQuizScore(
  classId: string,
  quizId: string,
  learnerId: string,
  request: AdjustScoreRequest,
): Promise<LearnerResultRowView> {
  return apiFetch<LearnerResultRowView>(`${creatorBase(classId)}/${quizId}/results/${learnerId}/score`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function clearLearnerQuizScoreAdjustment(
  classId: string,
  quizId: string,
  learnerId: string,
): Promise<LearnerResultRowView> {
  return apiFetch<LearnerResultRowView>(`${creatorBase(classId)}/${quizId}/results/${learnerId}/score`, {
    method: "DELETE",
  });
}

export function resetLearnerQuizAttempt(
  classId: string,
  quizId: string,
  learnerId: string,
): Promise<LearnerResultRowView> {
  return apiFetch<LearnerResultRowView>(`${creatorBase(classId)}/${quizId}/results/${learnerId}/reset`, {
    method: "POST",
  });
}

export function getClassQuizResultsPreflight(classId: string, quizId: string): Promise<ClassQuizPreflightView> {
  return apiFetch<ClassQuizPreflightView>(`${creatorBase(classId)}/${quizId}/publish-results/preflight`);
}

export function publishClassQuizResults(
  classId: string,
  quizId: string,
  confirmNonSubmitters: boolean,
): Promise<ClassQuizView> {
  return apiFetch<ClassQuizView>(`${creatorBase(classId)}/${quizId}/publish-results`, {
    method: "POST",
    body: JSON.stringify({ confirmNonSubmitters }),
  });
}

export function unpublishClassQuizResults(classId: string, quizId: string): Promise<ClassQuizView> {
  return apiFetch<ClassQuizView>(`${creatorBase(classId)}/${quizId}/unpublish-results`, { method: "POST" });
}

// ---- learner & guardian ----

/** Mirrors backend `ClassMemberQuizListView` - the student portal's own summary rows, under one class. */
export interface ClassMemberQuizListView {
  classId: string;
  className: string;
  quizzes: MyTakeHomeQuizSummaryView[];
}

/** Whose quizzes: a learner's own (no `learnerId`), or a guardian's followed learner's. */
export interface ClassQuizReader {
  classId: string;
  learnerId?: string;
}

function readerBase({ classId, learnerId }: ClassQuizReader): string {
  return learnerId
    ? `/api/v1/me/online-classes/${learnerId}/classes/${classId}/take-home-quizzes`
    : `/api/v1/learner/classes/${classId}/take-home-quizzes`;
}

/** A learner sees published quizzes; a guardian only those whose results are out. */
export function listMemberClassQuizzes(reader: ClassQuizReader): Promise<ClassMemberQuizListView> {
  return apiFetch<ClassMemberQuizListView>(readerBase(reader));
}

export function getMemberClassQuizReview(reader: ClassQuizReader, quizId: string): Promise<QuizReviewView> {
  return apiFetch<QuizReviewView>(`${readerBase(reader)}/${quizId}/review`);
}

/** The narrow, reference-checked image endpoint's path - the `useObjectUrl` key for {@link downloadClassQuizImage}. */
export function classQuizImagePath(reader: ClassQuizReader, quizId: string, fileId: string): string {
  return `${readerBase(reader)}/${quizId}/images/${fileId}`;
}

/** A blob fetch by full API path, since the image endpoint needs the Bearer header a bare `<img src>` can't carry. */
export function downloadClassQuizImage(path: string): Promise<Blob> {
  return apiFetchBlob(path);
}

// Taking a quiz is the learner's alone.
const learnerBase = (classId: string) => `/api/v1/learner/classes/${classId}/take-home-quizzes`;

export function getLearnerClassQuiz(classId: string, quizId: string): Promise<MyQuizInterstitialView> {
  return apiFetch<MyQuizInterstitialView>(`${learnerBase(classId)}/${quizId}`);
}

export function startLearnerClassQuiz(classId: string, quizId: string): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${learnerBase(classId)}/${quizId}/start`, { method: "POST" });
}

export function resumeLearnerClassQuiz(classId: string, quizId: string): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${learnerBase(classId)}/${quizId}/attempt`);
}

export function saveLearnerClassQuizAnswers(
  classId: string,
  quizId: string,
  answers: AnswerCommand[],
): Promise<QuizAttemptView> {
  return apiFetch<QuizAttemptView>(`${learnerBase(classId)}/${quizId}/answers`, {
    method: "PUT",
    body: JSON.stringify({ answers }),
  });
}

export function submitLearnerClassQuiz(classId: string, quizId: string): Promise<SubmitConfirmationView> {
  return apiFetch<SubmitConfirmationView>(`${learnerBase(classId)}/${quizId}/submit`, { method: "POST" });
}
