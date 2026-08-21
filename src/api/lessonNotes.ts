import { apiFetch, apiStream } from "@/api/client";
import type { Page } from "@/api/types";

/** Mirrors backend lessonnote.application.port.in.LevelSubjectView - one (level, subject) pair a teacher subject-teaches. */
export interface LevelSubjectView {
  levelId: string;
  levelName: string;
  subjectId: string;
  subjectName: string;
}

/**
 * Mirrors backend lessonnote.application.port.in.LessonNoteWeekView - one
 * row of the term's week grid, derived from the term's dates. `noteId`/
 * `topic`/`status` are null for a week nobody has authored a note for yet.
 */
export interface LessonNoteWeekView {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  noteId: string | null;
  topic: string | null;
  status: LessonNoteStatus | null;
}

export type LessonNoteStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

/** Mirrors backend lessonnote.domain.LessonNoteContent.PresentationStep. */
export interface PresentationStep {
  label: string;
  teacherActivity: string;
  learnerActivity: string;
}

/** Mirrors backend lessonnote.application.port.in.LessonNoteView.ContentView. */
export interface LessonNoteContentView {
  subTopic: string | null;
  duration: string | null;
  averageAge: string | null;
  objectives: string[];
  entryBehaviour: string | null;
  instructionalMaterials: string[];
  references: string[];
  presentation: PresentationStep[];
  evaluation: string | null;
  conclusion: string | null;
  assignment: string | null;
}

/** Mirrors backend lessonnote.application.port.in.LessonNoteView.ReviewView. Every field is null until its event has happened. */
export interface LessonNoteReviewView {
  submittedAt: string | null;
  submittedByName: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewComment: string | null;
}

/**
 * Mirrors backend lessonnote.application.port.in.LessonNoteView.ActionsView - server-derived from
 * the status table and the caller's own role/identity, so the frontend never re-implements it.
 */
export interface LessonNoteActionsView {
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canReview: boolean;
  canReopen: boolean;
}

/** Mirrors backend lessonnote.application.port.in.LessonNoteView. `status` crosses as its enum name. */
export interface LessonNoteView {
  id: string;
  subjectId: string;
  subjectName: string;
  levelId: string;
  levelName: string;
  termId: string;
  weekNumber: number;
  topic: string;
  content: LessonNoteContentView;
  status: LessonNoteStatus;
  aiGenerated: boolean;
  updatedByName: string | null;
  updatedAt: string;
  review: LessonNoteReviewView;
  actions: LessonNoteActionsView;
}

/** Mirrors backend lessonnote.application.port.in.LessonNoteQueueView - one row of the review queue. */
export interface LessonNoteQueueView {
  id: string;
  subjectId: string;
  subjectName: string | null;
  levelId: string;
  levelName: string | null;
  termId: string;
  termName: string | null;
  weekNumber: number;
  topic: string;
  status: LessonNoteStatus;
  submittedAt: string | null;
  submittedByName: string | null;
  updatedAt: string;
  updatedByName: string | null;
}

/** Mirrors backend lessonnote.application.port.in.PendingCountView - the admin nav-badge count. */
export interface PendingCountView {
  pendingReview: number;
}

/** Mirrors backend lessonnote.application.port.in.ReviewLessonNotesUseCase.Decision. */
export type ReviewDecision = "APPROVE" | "REJECT";

/**
 * Mirrors backend lessonnote.adapter.in.web.LessonNoteController.SaveLessonNoteRequest.
 * `aiGenerated` defaults to `false` server-side when omitted - the editor only sets it `true` once
 * an AI-generated result has actually been applied to the form via `AiGenerateSheet`.
 */
export interface SaveLessonNoteRequest {
  topic: string;
  content: LessonNoteContentView;
  aiGenerated?: boolean;
}

/** Mirrors backend lessonnote.adapter.in.web.LessonNoteGenerateController.GenerateRequest. `classHint`/`extraInstructions` are free text fed into the prompt - never persisted. */
export interface GenerateLessonNoteRequest {
  topic: string;
  classHint: string | null;
  extraInstructions: string | null;
}

/** Callbacks for each SSE frame `generateLessonNote` relays - see the endpoint's own Javadoc for what each frame means. */
export interface GenerateLessonNoteHandlers {
  onDelta: (text: string) => void;
  onResult: (content: LessonNoteContentView) => void;
  onError: (detail: string) => void;
}

/** Mirrors backend lessonnote.application.port.in.ManageLessonNotesUseCase.SubjectCopyOutcome - `copied`/`skipped` count weeks, not subjects. */
export interface SubjectCopyOutcome {
  subjectId: string;
  subjectName: string | null;
  success: boolean;
  copied: number;
  skipped: number;
  message: string | null;
}

export interface CopyLessonNotesResult {
  outcomes: SubjectCopyOutcome[];
}

const BASE = "/api/v1/lesson-notes";

/** One row per week of the term, whether or not a note exists for it yet - the grid is derived from the term, not from saved notes. */
export function getWeekGrid(subjectId: string, termId: string): Promise<LessonNoteWeekView[]> {
  return apiFetch<LessonNoteWeekView[]>(`${BASE}?subjectId=${subjectId}&termId=${termId}`);
}

export function getLessonNote(noteId: string): Promise<LessonNoteView> {
  return apiFetch<LessonNoteView>(`${BASE}/${noteId}`);
}

/** Creates the week's note if none exists yet, otherwise overwrites its topic/content - "edited by X", last writer wins. Always DRAFT afterward. */
export function saveLessonNote(
  subjectId: string,
  termId: string,
  weekNumber: number,
  request: SaveLessonNoteRequest,
): Promise<LessonNoteView> {
  return apiFetch<LessonNoteView>(`${BASE}?subjectId=${subjectId}&termId=${termId}&weekNumber=${weekNumber}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

const ME_BASE = "/api/v1/me/lesson-note-subjects";

/** The calling TEACHER's own deduped (level, subject) list for lesson notes. */
export function getMyLessonNoteSubjects(): Promise<LevelSubjectView[]> {
  return apiFetch<LevelSubjectView[]>(ME_BASE);
}

/** Moves a DRAFT/REJECTED note to SUBMITTED. */
export function submitLessonNote(noteId: string): Promise<LessonNoteView> {
  return apiFetch<LessonNoteView>(`${BASE}/${noteId}/submit`, { method: "POST" });
}

/** The submitter un-submits a SUBMITTED note back to DRAFT - only the note's own submitter may call this. */
export function withdrawLessonNote(noteId: string): Promise<LessonNoteView> {
  return apiFetch<LessonNoteView>(`${BASE}/${noteId}/withdraw`, { method: "POST" });
}

/** A reviewer approves or rejects a SUBMITTED note. `comment` is required for REJECT, optional for APPROVE. */
export function reviewLessonNote(
  noteId: string,
  decision: ReviewDecision,
  comment: string | null,
): Promise<LessonNoteView> {
  return apiFetch<LessonNoteView>(`${BASE}/${noteId}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, comment }),
  });
}

/** A reviewer reopens an APPROVED note back to DRAFT. */
export function reopenLessonNote(noteId: string): Promise<LessonNoteView> {
  return apiFetch<LessonNoteView>(`${BASE}/${noteId}/reopen`, { method: "POST" });
}

/** The admin review queue - every filter optional. */
export function getReviewQueue(
  levelId?: string,
  termId?: string,
  status?: LessonNoteStatus,
  page = 0,
  size = 20,
): Promise<Page<LessonNoteQueueView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (levelId) params.set("levelId", levelId);
  if (termId) params.set("termId", termId);
  if (status) params.set("status", status);
  return apiFetch<Page<LessonNoteQueueView>>(`${BASE}/review-queue?${params.toString()}`);
}

/** The admin nav-badge count - SUBMITTED notes awaiting review. */
export function getPendingLessonNoteCount(): Promise<PendingCountView> {
  return apiFetch<PendingCountView>(`${BASE}/pending-count`);
}

/**
 * Copies one or more subjects' lesson notes from `sourceTermId` into `targetTermId` in one
 * action - `ManageLessonNotesUseCase.copyFromTerm`'s batch contract, mirroring
 * `api/timetable.ts`'s `copyClassTimetables`. A TEACHER may call this too: each subject is
 * independently checked server-side, so their request simply reports a failed outcome row for
 * any subject they don't teach. A week the target term already holds is skipped, never
 * overwritten, and a copied note always lands DRAFT.
 */
export function copyLessonNotes(
  sourceTermId: string,
  targetTermId: string,
  subjectIds: string[],
): Promise<CopyLessonNotesResult> {
  return apiFetch<CopyLessonNotesResult>(`${BASE}/copy`, {
    method: "POST",
    body: JSON.stringify({ sourceTermId, targetTermId, subjectIds }),
  });
}

/**
 * AI-assisted generation of one week's lesson note content, streamed as SSE - Phase 16E. A
 * pre-flight refusal (entitlement, access, week range, quota) rejects the returned promise with the
 * usual {@link ApiError} before any frame arrives; once streaming starts, `handlers.onDelta` fires
 * per text chunk (a live preview), `handlers.onResult` fires once with the parsed/validated content
 * the "Use this" action applies to the form, and `handlers.onError` fires for a genuine mid-stream
 * failure (the only case where `delta` frames may already have arrived).
 */
export function generateLessonNote(
  subjectId: string,
  termId: string,
  weekNumber: number,
  request: GenerateLessonNoteRequest,
  handlers: GenerateLessonNoteHandlers,
  options?: { signal?: AbortSignal },
): Promise<void> {
  return apiStream(
    `${BASE}/generate?subjectId=${subjectId}&termId=${termId}&weekNumber=${weekNumber}`,
    (event, data) => {
      if (event === "delta") {
        handlers.onDelta((JSON.parse(data) as { text: string }).text);
      } else if (event === "result") {
        handlers.onResult(JSON.parse(data) as LessonNoteContentView);
      } else if (event === "error") {
        handlers.onError((JSON.parse(data) as { detail: string }).detail);
      }
    },
    { method: "POST", body: JSON.stringify(request), signal: options?.signal },
  );
}
