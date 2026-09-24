import { apiFetch, apiFetchBlob } from "@/api/client";
import type { Page } from "@/api/types";

export type QuizType = "MIDTERM" | "NORMAL";
export type QuestionType = "SINGLE_CHOICE" | "MULTI_CHOICE" | "FILL_IN_THE_GAP";
export type TakeHomeQuizStatus = "DRAFT" | "PUBLISHED" | "RESULTS_PUBLISHED" | "ARCHIVED";
export type TakeHomeQuizAvailability = "SCHEDULED" | "OPEN" | "CLOSED";

/** Mirrors backend takehomequiz.application.port.in.TakeHomeQuizSummaryView - one row of the paginated list. */
export interface TakeHomeQuizSummaryView {
  id: string;
  title: string;
  subjectName: string;
  className: string;
  quizType: QuizType;
  status: TakeHomeQuizStatus;
  availability: TakeHomeQuizAvailability | null;
  questionCount: number;
  totalPoints: number;
  opensAt: string;
  closesAt: string;
  updatedAt: string;
}

/** Mirrors backend takehomequiz.application.port.in.TakeHomeQuizView.OptionView. */
export interface TakeHomeQuizOptionView {
  id: string;
  position: number;
  /** Sanitized HTML - see backend `takehomequiz.domain.QuizRichText`. Render with `RichContent`, never as plain text. */
  label: string;
  correct: boolean;
}

/** Mirrors backend takehomequiz.application.port.in.TakeHomeQuizView.AnswerKeyView. */
export interface TakeHomeQuizAnswerKeyView {
  id: string;
  position: number;
  expectedAnswer: string;
}

/** Mirrors backend takehomequiz.application.port.in.TakeHomeQuizView.QuestionView. */
export interface TakeHomeQuizQuestionView {
  id: string;
  position: number;
  questionType: QuestionType;
  /** Sanitized HTML authored via `RichTextField` - see backend `takehomequiz.domain.QuizRichText`. Render with `RichContent`, never as plain text. */
  prompt: string;
  points: number;
  options: TakeHomeQuizOptionView[];
  answerKeys: TakeHomeQuizAnswerKeyView[];
}

/**
 * Mirrors backend takehomequiz.application.port.in.TakeHomeQuizView.ActionsView -
 * server-derived from the quiz's status and whether a submission exists, so
 * the frontend never re-derives it (the `LessonNoteView.ActionsView` precedent).
 * `canPublish` (Phase 20C) is true for a `DRAFT` or already-`PUBLISHED` quiz -
 * an idempotent republish tops up late joiners' links. `canPublishResults`/
 * `canUnpublishResults` (Phase 20F) mirror the backend's own `publishResults`/
 * `unpublishResults` transition guards the same way.
 */
export interface TakeHomeQuizActionsView {
  canEditMetadata: boolean;
  canEditQuestions: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canPublishResults: boolean;
  canUnpublishResults: boolean;
}

/** Mirrors backend takehomequiz.application.port.in.TakeHomeQuizView - the full staff detail. */
export interface TakeHomeQuizView {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  title: string;
  instructions: string | null;
  quizType: QuizType;
  status: TakeHomeQuizStatus;
  timed: boolean;
  durationMinutes: number | null;
  opensAt: string;
  closesAt: string;
  /** Off by default - see backend `TakeHomeQuiz`'s Javadoc. Never frozen once a submission exists, unlike most of this view's other fields. */
  revealResultsOnSubmit: boolean;
  totalPoints: number;
  questions: TakeHomeQuizQuestionView[];
  actions: TakeHomeQuizActionsView;
  updatedAt: string;
}

/** Mirrors backend takehomequiz.application.port.in.PublishReadinessView. */
export interface PublishReadinessView {
  canPublish: boolean;
  blockers: string[];
  totalPoints: number;
  midtermMax: number | null;
  rosterSize: number;
}

/** Mirrors backend takehomequiz.application.port.in.AuthorableSubjectView. */
export interface AuthorableSubjectView {
  subjectId: string;
  subjectName: string;
}

export interface OptionCommand {
  id: string | null;
  label: string;
  correct: boolean;
}

export interface AnswerKeyCommand {
  id: string | null;
  expectedAnswer: string;
}

/** {@code id} null means a freshly authored question; a non-null id updates that row in place. Position is derived server-side from list order, never sent. */
export interface QuestionCommand {
  id: string | null;
  questionType: QuestionType;
  prompt: string;
  points: number;
  options: OptionCommand[];
  answerKeys: AnswerKeyCommand[];
}

export interface CreateTakeHomeQuizRequest {
  classId: string;
  subjectId: string;
  termId: string;
  title: string;
  instructions: string | null;
  quizType: QuizType;
  timed: boolean;
  durationMinutes: number | null;
  opensAt: string;
  closesAt: string;
  revealResultsOnSubmit: boolean;
}

export interface UpdateTakeHomeQuizRequest {
  title: string;
  instructions: string | null;
  quizType: QuizType;
  timed: boolean;
  durationMinutes: number | null;
  opensAt: string;
  closesAt: string;
  revealResultsOnSubmit: boolean;
}

/** Mirrors backend takehomequiz.application.port.in.PublishOutcomeView.RowOutcome. */
export interface TakeHomeQuizRowOutcome {
  studentId: string;
  studentName: string;
  success: boolean;
  message: string | null;
}

/** Mirrors backend takehomequiz.application.port.in.PublishOutcomeView. */
export interface PublishOutcomeView {
  tokensMinted: number;
  guardiansNotified: number;
  perStudent: TakeHomeQuizRowOutcome[];
}

/**
 * Mirrors backend takehomequiz.application.port.in.StudentLinkView - `url`/`issuedAt` are null for
 * a roster student with no live link yet. `portalStudent` (Phase 35I.1) is true when this student
 * currently holds an active student-portal login - such a student is never minted a token in the
 * first place, so `url == null && portalStudent` means "takes this quiz in the portal", not "still
 * needs a link".
 */
export interface StudentLinkView {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  url: string | null;
  issuedAt: string | null;
  portalStudent: boolean;
}

/** Mirrors backend PublishTakeHomeQuizUseCase.RevokeSupersededLinksOutcome (Phase 35I.4). */
export interface RevokeSupersededLinksOutcome {
  revoked: number;
  skippedInProgress: number;
}

const BASE = "/api/v1/take-home-quizzes";

export function listTakeHomeQuizzes(
  classId: string,
  termId: string,
  subjectId?: string,
  status?: TakeHomeQuizStatus,
  page = 0,
  size = 20,
): Promise<Page<TakeHomeQuizSummaryView>> {
  const params = new URLSearchParams({ classId, termId, page: String(page), size: String(size) });
  if (subjectId) params.set("subjectId", subjectId);
  if (status) params.set("status", status);
  return apiFetch<Page<TakeHomeQuizSummaryView>>(`${BASE}?${params.toString()}`);
}

export function getTakeHomeQuiz(quizId: string): Promise<TakeHomeQuizView> {
  return apiFetch<TakeHomeQuizView>(`${BASE}/${quizId}`);
}

export function createTakeHomeQuiz(request: CreateTakeHomeQuizRequest): Promise<TakeHomeQuizView> {
  return apiFetch<TakeHomeQuizView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateTakeHomeQuiz(quizId: string, request: UpdateTakeHomeQuizRequest): Promise<TakeHomeQuizView> {
  return apiFetch<TakeHomeQuizView>(`${BASE}/${quizId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function saveTakeHomeQuizQuestions(
  quizId: string,
  questions: QuestionCommand[],
): Promise<TakeHomeQuizView> {
  return apiFetch<TakeHomeQuizView>(`${BASE}/${quizId}/questions`, {
    method: "PUT",
    body: JSON.stringify({ questions }),
  });
}

export function deleteTakeHomeQuiz(quizId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${quizId}`, { method: "DELETE" });
}

export function getTakeHomeQuizValidation(quizId: string): Promise<PublishReadinessView> {
  return apiFetch<PublishReadinessView>(`${BASE}/${quizId}/validation`);
}

export function getAuthorableSubjects(classId: string): Promise<AuthorableSubjectView[]> {
  return apiFetch<AuthorableSubjectView[]>(`${BASE}/authorable-subjects?classId=${classId}`);
}

export function publishTakeHomeQuiz(quizId: string): Promise<PublishOutcomeView> {
  return apiFetch<PublishOutcomeView>(`${BASE}/${quizId}/publish`, { method: "POST" });
}

export function getTakeHomeQuizLinks(quizId: string): Promise<StudentLinkView[]> {
  return apiFetch<StudentLinkView[]>(`${BASE}/${quizId}/links`);
}

export function reissueTakeHomeQuizLink(quizId: string, studentId: string): Promise<StudentLinkView> {
  return apiFetch<StudentLinkView>(`${BASE}/${quizId}/links/${studentId}/reissue`, { method: "POST" });
}

export function issueMissingTakeHomeQuizLinks(quizId: string): Promise<PublishOutcomeView> {
  return apiFetch<PublishOutcomeView>(`${BASE}/${quizId}/links/issue-missing`, { method: "POST" });
}

/** Revokes only live tokens belonging to a student who now has a portal login and hasn't started an attempt yet (Phase 35I.4). */
export function revokeSupersededTakeHomeQuizLinks(quizId: string): Promise<RevokeSupersededLinksOutcome> {
  return apiFetch<RevokeSupersededLinksOutcome>(`${BASE}/${quizId}/links/revoke-superseded`, { method: "POST" });
}

export function exportTakeHomeQuizLinks(quizId: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/${quizId}/links/export`);
}

/** Mirrors backend takehomequiz.application.port.in.ReviewTakeHomeQuizResultsUseCase.AttemptState (Phase 20E) - deliberately a separate type from `AttemptState` in `publicTakeHomeQuiz.ts`, even though the values coincide, matching the backend's own "distinct staff vs. public shapes" precedent. */
export type TakeHomeQuizAttemptState = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";

/** Mirrors backend ReviewTakeHomeQuizResultsUseCase.StudentRef - a non-submitter's identity only. */
export interface TakeHomeQuizStudentRef {
  studentId: string;
  fullName: string;
}

/** Mirrors backend ReviewTakeHomeQuizResultsUseCase.StudentResultRowView. */
export interface StudentResultRowView {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  attemptState: TakeHomeQuizAttemptState;
  autoScore: number | null;
  adjustedScore: number | null;
  effectiveScore: number | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  resetCount: number;
}

/** Mirrors backend ReviewTakeHomeQuizResultsUseCase.TakeHomeQuizResultsView. */
export interface TakeHomeQuizResultsView {
  totalPoints: number;
  rosterSize: number;
  submittedCount: number;
  rows: StudentResultRowView[];
  nonSubmitters: TakeHomeQuizStudentRef[];
}

/** Mirrors backend ReviewTakeHomeQuizResultsUseCase.AnsweredQuestionView - the staff, answer-key-carrying counterpart to `publicTakeHomeQuiz.ts`'s `PublicQuestionView`, which never carries one. */
export interface AnsweredQuestionView {
  questionId: string;
  position: number;
  questionType: QuestionType;
  /** Sanitized HTML - see backend `takehomequiz.domain.QuizRichText`. Render with `RichContent`, never as plain text. */
  prompt: string;
  points: number;
  options: TakeHomeQuizOptionView[];
  answerKeys: TakeHomeQuizAnswerKeyView[];
  selectedOptionIds: string[];
  textAnswer: string | null;
  awardedPoints: number | null;
  correct: boolean | null;
}

/** Mirrors backend ReviewTakeHomeQuizResultsUseCase.StudentAttemptDetailView. */
export interface StudentAttemptDetailView {
  studentId: string;
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

export interface AdjustScoreRequest {
  newScore: number;
  reason: string;
}

export function getTakeHomeQuizResults(quizId: string): Promise<TakeHomeQuizResultsView> {
  return apiFetch<TakeHomeQuizResultsView>(`${BASE}/${quizId}/results`);
}

export function getStudentTakeHomeQuizResult(
  quizId: string,
  studentId: string,
): Promise<StudentAttemptDetailView> {
  return apiFetch<StudentAttemptDetailView>(`${BASE}/${quizId}/results/${studentId}`);
}

export function adjustTakeHomeQuizScore(
  quizId: string,
  studentId: string,
  request: AdjustScoreRequest,
): Promise<StudentResultRowView> {
  return apiFetch<StudentResultRowView>(`${BASE}/${quizId}/results/${studentId}/score`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function clearTakeHomeQuizScoreAdjustment(
  quizId: string,
  studentId: string,
): Promise<StudentResultRowView> {
  return apiFetch<StudentResultRowView>(`${BASE}/${quizId}/results/${studentId}/score`, { method: "DELETE" });
}

export function resetTakeHomeQuizAttempt(quizId: string, studentId: string): Promise<StudentResultRowView> {
  return apiFetch<StudentResultRowView>(`${BASE}/${quizId}/results/${studentId}/reset`, { method: "POST" });
}

/**
 * Mirrors backend takehomequiz.application.port.in.PreflightView (Phase 20F) - the mandatory
 * confirmation screen's data. `nonSubmitters` is exactly who `publishTakeHomeQuizResults` will
 * score 0 and write back if `confirmNonSubmitterZeros` is true. `willWriteBack` is false for a
 * NORMAL quiz or whenever `blockers` is non-empty. `midtermMax` is null for a NORMAL quiz or when
 * the level's midterm maximum couldn't be resolved.
 */
export interface PreflightView {
  canPublish: boolean;
  blockers: string[];
  nonSubmitters: TakeHomeQuizStudentRef[];
  submittedCount: number;
  rosterSize: number;
  willWriteBack: boolean;
  midtermMax: number | null;
}

export interface PublishResultsRequest {
  confirmNonSubmitterZeros: boolean;
}

/** Mirrors backend takehomequiz.application.port.in.WriteBackOutcomeView. */
export interface WriteBackOutcomeView {
  published: boolean;
  scoresWritten: number;
  perStudent: TakeHomeQuizRowOutcome[];
}

export function getPublishResultsPreflight(quizId: string): Promise<PreflightView> {
  return apiFetch<PreflightView>(`${BASE}/${quizId}/publish-results/preflight`);
}

export function publishTakeHomeQuizResults(
  quizId: string,
  confirmNonSubmitterZeros: boolean,
): Promise<WriteBackOutcomeView> {
  return apiFetch<WriteBackOutcomeView>(`${BASE}/${quizId}/publish-results`, {
    method: "POST",
    body: JSON.stringify({ confirmNonSubmitterZeros } satisfies PublishResultsRequest),
  });
}

export function unpublishTakeHomeQuizResults(quizId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${quizId}/unpublish-results`, { method: "POST" });
}
