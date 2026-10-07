import { apiFetch, apiFetchBlob, apiStream } from "@/api/client";
import type { Page } from "@/api/types";

/**
 * Mirrors backend lessonnote.application.port.in.LevelSubjectView - one (level, subject) pair a
 * teacher subject-teaches, or one of a class they class-teach/assist.
 */
export interface LevelSubjectView {
  levelId: string;
  levelName: string;
  subjectId: string;
  subjectName: string;
  /** False for a class teacher's subject that already has a subject teacher - its notes are read-only to them. */
  authorable: boolean;
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

/** Mirrors backend lessonnote.domain.LessonNoteContent.ContentMode - which half of a `LessonNoteContentView` is authoritative. */
export type LessonNoteContentMode = "STRUCTURED" | "DOCUMENT";

/**
 * Mirrors backend lessonnote.application.port.in.LessonNoteView.ContentView.
 * Phase 16G's `mode`/`body` are the free-form document half - `body` is
 * sanitized HTML rendered through `RichContent`, present only when
 * `mode` is `"DOCUMENT"`; the eleven fields below are the original
 * structured NERDC form, present only when `mode` is `"STRUCTURED"`. Both
 * halves persist regardless of which is active, so switching mode in the
 * editor is non-destructive.
 */
export interface LessonNoteContentView {
  mode: LessonNoteContentMode;
  body: string | null;
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
  /** The branch that owns this note - each branch authors its own scheme of work. */
  branchId: string;
  /** Null for a whole-class note - see `classId`. */
  subjectId: string | null;
  subjectName: string | null;
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
  /** Set only on a whole-class note (one note per class per week covering every subject); always document mode. */
  classId: string | null;
  className: string | null;
}

/** Mirrors backend lessonnote.application.port.in.LessonNoteQueueView - one row of the review queue. */
export interface LessonNoteQueueView {
  id: string;
  branchId: string;
  subjectId: string | null;
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
  /** Set only on a whole-class note, whose `subjectId`/`subjectName` are null. */
  classId: string | null;
  className: string | null;
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

/**
 * Lesson notes are branch-scoped: `branchId` names the branch a SCHOOL_ADMIN is working in (the
 * server requires it from them) and is omitted for everyone else, whose own branch the server
 * derives from their token - the `useBranchScope` contract.
 */
function branchParam(branchId: string | undefined): string {
  return branchId ? `&branchId=${branchId}` : "";
}

/** One row per week of the term, whether or not a note exists for it yet - the grid is derived from the term, not from saved notes. */
export function getWeekGrid(subjectId: string, termId: string, branchId?: string): Promise<LessonNoteWeekView[]> {
  return apiFetch<LessonNoteWeekView[]>(`${BASE}?subjectId=${subjectId}&termId=${termId}${branchParam(branchId)}`);
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
  branchId?: string,
): Promise<LessonNoteView> {
  return apiFetch<LessonNoteView>(
    `${BASE}?subjectId=${subjectId}&termId=${termId}&weekNumber=${weekNumber}${branchParam(branchId)}`,
    {
      method: "PUT",
      body: JSON.stringify(request),
    },
  );
}

const ME_BASE = "/api/v1/me/lesson-note-subjects";

/** The calling TEACHER's own deduped (level, subject) list for lesson notes. */
export function getMyLessonNoteSubjects(): Promise<LevelSubjectView[]> {
  return apiFetch<LevelSubjectView[]>(ME_BASE);
}

/** Mirrors backend LessonNoteClassView - a class whose whole-class notes the calling TEACHER can open. */
export interface LessonNoteClassView {
  classId: string;
  className: string;
  levelId: string;
  levelName: string;
  /** True only for the class's class/assistant teacher; a subject teacher of the class may only read. */
  authorable: boolean;
}

/** Mirrors backend ClassWeekGridView - one class's whole-class note grid for a term. */
export interface ClassWeekGridView {
  classId: string;
  className: string;
  levelId: string;
  levelName: string;
  branchId: string;
  /** The subjects the class's level takes this term - a new note's body is seeded with a heading per subject. */
  subjectNames: string[];
  weeks: LessonNoteWeekView[];
}

/** Every class the calling TEACHER class-teaches, assists, or subject-teaches. */
export function getMyLessonNoteClasses(): Promise<LessonNoteClassView[]> {
  return apiFetch<LessonNoteClassView[]>("/api/v1/me/lesson-note-classes");
}

/** A class's whole-class note grid - one row per week of the term, whether or not a note exists yet. */
export function getClassWeekGrid(classId: string, termId: string): Promise<ClassWeekGridView> {
  return apiFetch<ClassWeekGridView>(`${BASE}/class-weeks?classId=${classId}&termId=${termId}`);
}

/** Creates or edits a class's whole-class note for one week. The content must be document mode. */
export function saveClassWeekNote(
  classId: string,
  termId: string,
  weekNumber: number,
  request: SaveLessonNoteRequest,
): Promise<LessonNoteView> {
  return apiFetch<LessonNoteView>(
    `${BASE}/class-weeks?classId=${classId}&termId=${termId}&weekNumber=${weekNumber}`,
    { method: "PUT", body: JSON.stringify(request) },
  );
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

/** The admin review queue - every filter optional; an omitted `branchId` is every branch for a SCHOOL_ADMIN. */
export function getReviewQueue(
  levelId?: string,
  termId?: string,
  status?: LessonNoteStatus,
  page = 0,
  size = 20,
  branchId?: string,
): Promise<Page<LessonNoteQueueView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (branchId) params.set("branchId", branchId);
  if (levelId) params.set("levelId", levelId);
  if (termId) params.set("termId", termId);
  if (status) params.set("status", status);
  return apiFetch<Page<LessonNoteQueueView>>(`${BASE}/review-queue?${params.toString()}`);
}

/** The admin nav-badge count - SUBMITTED notes awaiting review, school-wide for a SCHOOL_ADMIN, own branch otherwise. */
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
  branchId?: string,
): Promise<CopyLessonNotesResult> {
  return apiFetch<CopyLessonNotesResult>(`${BASE}/copy`, {
    method: "POST",
    body: JSON.stringify({ branchId: branchId ?? null, sourceTermId, targetTermId, subjectIds }),
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
  options?: { signal?: AbortSignal; branchId?: string },
): Promise<void> {
  return apiStream(
    `${BASE}/generate?subjectId=${subjectId}&termId=${termId}&weekNumber=${weekNumber}${branchParam(options?.branchId)}`,
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

// ---- Class lesson notes (creators Phase C12) ----

/** A creator's class note is only ever DRAFT or PUBLISHED - no review workflow. */
export type ClassLessonNoteStatus = "DRAFT" | "PUBLISHED";

/** Mirrors backend `ClassLessonNoteView.ActionsView` - server-derived, never re-implemented here. */
export interface ClassLessonNoteActionsView {
  canEdit: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canDelete: boolean;
}

/** Mirrors backend `lessonnote.application.port.in.ClassLessonNoteView`. */
export interface ClassLessonNoteView {
  id: string;
  classId: string;
  className: string;
  /** ISO date (YYYY-MM-DD), or null for a note about the class as a whole. */
  sessionDate: string | null;
  topic: string;
  content: LessonNoteContentView;
  status: ClassLessonNoteStatus;
  aiGenerated: boolean;
  updatedAt: string;
  publishedAt: string | null;
  actions: ClassLessonNoteActionsView;
}

/** Mirrors backend `ClassLessonNoteSummary` - one list row. */
export interface ClassLessonNoteSummary {
  id: string;
  sessionDate: string | null;
  topic: string;
  status: ClassLessonNoteStatus;
  aiGenerated: boolean;
  updatedAt: string;
  publishedAt: string | null;
}

/** Mirrors backend `ClassLessonNoteListView`. `writable` is false for an archived/over-limit class, and always for a reader. */
export interface ClassLessonNoteListView {
  classId: string;
  className: string;
  writable: boolean;
  notes: ClassLessonNoteSummary[];
}

/** Mirrors backend `CreatorLessonNoteController.SaveClassLessonNoteRequest`. */
export interface SaveClassLessonNoteRequest {
  sessionDate: string | null;
  topic: string;
  content: LessonNoteContentView;
  aiGenerated?: boolean;
}

/** Mirrors backend `CreatorLessonNoteController.GenerateClassLessonNoteRequest`. */
export interface GenerateClassLessonNoteRequest {
  topic: string;
  sessionDate: string | null;
  audienceHint: string | null;
  extraInstructions: string | null;
}

const classNotesBase = (classId: string) => `/api/v1/virtual-classes/${classId}/lesson-notes`;

export function listClassLessonNotes(classId: string): Promise<ClassLessonNoteListView> {
  return apiFetch<ClassLessonNoteListView>(classNotesBase(classId));
}

export function getClassLessonNote(classId: string, noteId: string): Promise<ClassLessonNoteView> {
  return apiFetch<ClassLessonNoteView>(`${classNotesBase(classId)}/${noteId}`);
}

export function createClassLessonNote(
  classId: string,
  request: SaveClassLessonNoteRequest,
): Promise<ClassLessonNoteView> {
  return apiFetch<ClassLessonNoteView>(classNotesBase(classId), {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function updateClassLessonNote(
  classId: string,
  noteId: string,
  request: SaveClassLessonNoteRequest,
): Promise<ClassLessonNoteView> {
  return apiFetch<ClassLessonNoteView>(`${classNotesBase(classId)}/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function publishClassLessonNote(classId: string, noteId: string): Promise<ClassLessonNoteView> {
  return apiFetch<ClassLessonNoteView>(`${classNotesBase(classId)}/${noteId}/publish`, { method: "POST" });
}

export function unpublishClassLessonNote(classId: string, noteId: string): Promise<ClassLessonNoteView> {
  return apiFetch<ClassLessonNoteView>(`${classNotesBase(classId)}/${noteId}/unpublish`, { method: "POST" });
}

export function deleteClassLessonNote(classId: string, noteId: string): Promise<void> {
  return apiFetch<void>(`${classNotesBase(classId)}/${noteId}`, { method: "DELETE" });
}

/** A creator's AI draft for a class note - the same frames and pre-flight refusals as {@link generateLessonNote}. */
export function generateClassLessonNote(
  classId: string,
  request: GenerateClassLessonNoteRequest,
  handlers: GenerateLessonNoteHandlers,
  signal?: AbortSignal,
): Promise<void> {
  return apiStream(
    `${classNotesBase(classId)}/generate`,
    (event, data) => {
      if (event === "delta") {
        handlers.onDelta((JSON.parse(data) as { text: string }).text);
      } else if (event === "result") {
        handlers.onResult(JSON.parse(data) as LessonNoteContentView);
      } else if (event === "error") {
        handlers.onError((JSON.parse(data) as { detail: string }).detail);
      }
    },
    { method: "POST", body: JSON.stringify(request), signal },
  );
}

/**
 * Where a learner or guardian reads one class's published notes. A learner's own reads carry only
 * the class; a guardian's also name the followed learner.
 */
export interface ClassNotesReader {
  classId: string;
  /** Set only for a guardian - the learner they follow. */
  learnerId?: string;
}

function readerBase({ classId, learnerId }: ClassNotesReader): string {
  return learnerId
    ? `/api/v1/me/online-classes/${learnerId}/classes/${classId}/lesson-notes`
    : `/api/v1/learner/classes/${classId}/lesson-notes`;
}

export function listPublishedClassLessonNotes(reader: ClassNotesReader): Promise<ClassLessonNoteListView> {
  return apiFetch<ClassLessonNoteListView>(readerBase(reader));
}

export function getPublishedClassLessonNote(reader: ClassNotesReader, noteId: string): Promise<ClassLessonNoteView> {
  return apiFetch<ClassLessonNoteView>(`${readerBase(reader)}/${noteId}`);
}

/** The narrow image path a reader's `<img>` resolves through - `/api/v1/files` never admits a learner or guardian. */
export function classLessonNoteImagePath(reader: ClassNotesReader, noteId: string, fileId: string): string {
  return `${readerBase(reader)}/${noteId}/images/${fileId}`;
}

/** Fetches an image by its full API path - the `useObjectUrl` fetcher for {@link classLessonNoteImagePath}. */
export function downloadClassLessonNoteImage(path: string): Promise<Blob> {
  return apiFetchBlob(path);
}
