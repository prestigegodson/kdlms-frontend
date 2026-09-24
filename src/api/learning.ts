import { apiFetch, apiFetchBlob, apiFetchBlobWithProgress, type DownloadProgress } from "@/api/client";
import type { Page } from "@/api/types";

export type LearningResourceType = "PDF" | "RICH_TEXT" | "YOUTUBE" | "AUDIO" | "VIDEO";
export type LearningResourceStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/** Mirrors backend learning.application.port.in.AuthorableSubjectView. */
export interface AuthorableSubjectView {
  subjectId: string;
  subjectName: string;
}

/** Mirrors backend learning.application.port.in.LearningResourceSummaryView - one row of the staff list. */
export interface LearningResourceSummaryView {
  id: string;
  title: string;
  subjectName: string;
  resourceType: LearningResourceType;
  status: LearningResourceStatus;
  position: number;
  /** Optional, independent visibility window (Phase 35L) - a student sees this resource only between these instants, on top of its publish status. Either/both may be null. */
  availableFrom: string | null;
  availableUntil: string | null;
  updatedAt: string;
}

/** Mirrors backend learning.application.port.in.LearningResourceView.ActionsView - server-derived, the frontend never re-derives it. */
export interface LearningResourceActionsView {
  canEdit: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canArchive: boolean;
  canDelete: boolean;
}

/** Mirrors backend learning.application.port.in.LearningResourceView - the full staff detail. */
export interface LearningResourceView {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  title: string;
  description: string | null;
  resourceType: LearningResourceType;
  /** Sanitized HTML - see backend `learning.domain.LearningRichText`. Render with `RichContent`, never as plain text. Present only for `RICH_TEXT`. */
  bodyHtml: string | null;
  fileId: string | null;
  youtubeVideoId: string | null;
  durationSeconds: number | null;
  commentsEnabled: boolean;
  status: LearningResourceStatus;
  position: number;
  /** Optional, independent visibility window (Phase 35L) - see `LearningResourceSummaryView`. */
  availableFrom: string | null;
  availableUntil: string | null;
  actions: LearningResourceActionsView;
  updatedAt: string;
}

/** Mirrors backend learning.adapter.in.web.LearningResourceController.CreateLearningResourceRequest. Exactly one of `bodyHtml`/`fileId`/`youtubeUrl` applies, matching `resourceType`. */
export interface CreateLearningResourceRequest {
  classId: string;
  subjectId: string;
  termId: string;
  title: string;
  description: string | null;
  resourceType: LearningResourceType;
  bodyHtml: string | null;
  fileId: string | null;
  /** A raw YouTube URL, never a bare id - the backend parses and validates it (`learning.domain.YouTubeVideoId`). */
  youtubeUrl: string | null;
  durationSeconds: number | null;
  /** Optional, independent visibility window (Phase 35L) - build with `localDateToStartInstant`/`localDateToEndInstant` from a date picker, never a raw local time. */
  availableFrom: string | null;
  availableUntil: string | null;
}

/** Mirrors backend learning.adapter.in.web.LearningResourceController.UpdateLearningResourceRequest. `resourceType` isn't here - it's immutable once created. */
export interface UpdateLearningResourceRequest {
  title: string;
  description: string | null;
  bodyHtml: string | null;
  fileId: string | null;
  youtubeUrl: string | null;
  durationSeconds: number | null;
  availableFrom: string | null;
  availableUntil: string | null;
}

/** Mirrors backend learning.application.port.in.MyLearningResourceSummaryView - one row of the calling STUDENT's own resource list, published only. `completed` (Phase 35H) is the caller's own interaction state, resolved in one batched query for the whole list. */
export interface MyLearningResourceSummaryView {
  id: string;
  title: string;
  description: string | null;
  subjectName: string;
  resourceType: LearningResourceType;
  durationSeconds: number | null;
  position: number;
  completed: boolean;
  /** Set only when the resource has an end of its availability window (Phase 35L) - shown as an "Available until ..." hint; the row is simply absent from this list once it's actually passed, so this is never used client-side to decide visibility. */
  availableUntil: string | null;
}

/** Mirrors backend learning.application.port.in.MyLearningResourceView - the calling STUDENT's own full detail. No `fileId` - a file's bytes come from this same resource's own `/file` endpoint. `fileSizeBytes` (Phase 35F) is present only for a file-backed type (`PDF`/`AUDIO`/`VIDEO`) - it lets the player show a determinate progress bar before the first byte arrives. `completed`/`positionSeconds` (Phase 35H) are the caller's own current interaction state - `positionSeconds` seeds an audio/video player's resume point. */
export interface MyLearningResourceView {
  id: string;
  title: string;
  description: string | null;
  subjectName: string;
  resourceType: LearningResourceType;
  bodyHtml: string | null;
  youtubeVideoId: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  commentsEnabled: boolean;
  completed: boolean;
  positionSeconds: number | null;
}

/** Mirrors backend learning.application.port.in.LearningCommentView - one entry in a resource's discussion. `canEdit`/`canModerate`/`editableUntil` are server-computed per caller, never re-derived client-side. `body` is always plain text - render as a React text child, never with `RichContent`/`dangerouslySetInnerHTML`. */
export interface LearningCommentView {
  commentId: string;
  resourceId: string;
  authorName: string;
  isSelf: boolean;
  body: string;
  createdAt: string;
  editedAt: string | null;
  hidden: boolean;
  canEdit: boolean;
  canModerate: boolean;
  editableUntil: string;
}

/** Mirrors backend learning.application.port.in.MyLearningInteractionView (Phase 35H) - the calling STUDENT's own current interaction state with one resource, returned by every `recordMyLearningInteraction` call so the UI always renders from server-confirmed state rather than an optimistic guess. */
export interface MyLearningInteractionView {
  resourceId: string;
  completed: boolean;
  completedAt: string | null;
  positionSeconds: number | null;
  lastOpenedAt: string | null;
}

/** Mirrors backend learning.adapter.in.web.MyLearningResourcesController.RecordInteractionRequest. Both fields are independently optional - `null`/omitted means "leave unchanged" - so a position ping can never clear a done flag and the mark-done control can never clobber a resume position. An all-fields-omitted body is legal and means "I opened this resource". */
export interface RecordLearningInteractionRequest {
  completed?: boolean | null;
  positionSeconds?: number | null;
}

/**
 * Mirrors backend learning.application.port.in.LearningGalleryFileView (Phase 35K) - one deduped
 * row of an already-uploaded file at the caller's own level+branch scope, labelled by the most
 * recently updated resource that references it. `durationSeconds` comes straight from that
 * resource, so picking an `AUDIO`/`VIDEO` file skips the fresh-upload duration probe entirely.
 * `uploadedAt` is the underlying file's own upload date - distinct from `lastUsedAt`, which is the
 * labelling resource's own `updatedAt` and isn't rendered anywhere today.
 */
export interface LearningGalleryFileView {
  fileId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  resourceType: LearningResourceType;
  durationSeconds: number | null;
  resourceTitle: string;
  className: string;
  subjectName: string;
  useCount: number;
  lastUsedAt: string;
  uploadedAt: string;
}

/** Mirrors backend learning.application.port.in.ResourceCompletionsView (Phase 35H) - the staff-facing roster-vs-interactions read for one resource. */
export interface ResourceCompletionsView {
  resourceId: string;
  title: string;
  totalStudents: number;
  completedCount: number;
  students: StudentCompletionView[];
}

/** One roster row of {@link ResourceCompletionsView}. `completedAt`/`positionSeconds`/`lastOpenedAt` are all null for a student who has never opened the resource. */
export interface StudentCompletionView {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  completed: boolean;
  completedAt: string | null;
  positionSeconds: number | null;
  lastOpenedAt: string | null;
}

const BASE = "/api/v1/learning-resources";

export function listLearningResources(
  classId: string,
  termId: string,
  subjectId?: string,
  status?: LearningResourceStatus,
  page = 0,
  size = 20,
): Promise<Page<LearningResourceSummaryView>> {
  const params = new URLSearchParams({ classId, termId, page: String(page), size: String(size) });
  if (subjectId) params.set("subjectId", subjectId);
  if (status) params.set("status", status);
  return apiFetch<Page<LearningResourceSummaryView>>(`${BASE}?${params.toString()}`);
}

export function getLearningResource(resourceId: string): Promise<LearningResourceView> {
  return apiFetch<LearningResourceView>(`${BASE}/${resourceId}`);
}

export function getAuthorableSubjects(classId: string): Promise<AuthorableSubjectView[]> {
  return apiFetch<AuthorableSubjectView[]>(`${BASE}/authorable-subjects?classId=${classId}`);
}

export function createLearningResource(request: CreateLearningResourceRequest): Promise<LearningResourceView> {
  return apiFetch<LearningResourceView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateLearningResource(
  resourceId: string,
  request: UpdateLearningResourceRequest,
): Promise<LearningResourceView> {
  return apiFetch<LearningResourceView>(`${BASE}/${resourceId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function publishLearningResource(resourceId: string): Promise<LearningResourceView> {
  return apiFetch<LearningResourceView>(`${BASE}/${resourceId}/publish`, { method: "POST" });
}

export function unpublishLearningResource(resourceId: string): Promise<LearningResourceView> {
  return apiFetch<LearningResourceView>(`${BASE}/${resourceId}/unpublish`, { method: "POST" });
}

export function archiveLearningResource(resourceId: string): Promise<LearningResourceView> {
  return apiFetch<LearningResourceView>(`${BASE}/${resourceId}/archive`, { method: "POST" });
}

export function deleteLearningResource(resourceId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${resourceId}`, { method: "DELETE" });
}

/** Reassigns positions to match `orderedResourceIds`' order - refused unless the list is exactly this class/subject/term's own resource set. */
export function reorderLearningResources(
  classId: string,
  subjectId: string,
  termId: string,
  orderedResourceIds: string[],
): Promise<LearningResourceSummaryView[]> {
  return apiFetch<LearningResourceSummaryView[]>(`${BASE}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ classId, subjectId, termId, orderedResourceIds }),
  });
}

// Comment moderation (Phase 35G) - staff never posts into a resource's discussion, only
// moderates it; see the backend's ManageLearningCommentsUseCase for why.

export function listLearningComments(resourceId: string): Promise<LearningCommentView[]> {
  return apiFetch<LearningCommentView[]>(`${BASE}/${resourceId}/comments`);
}

export function hideLearningComment(resourceId: string, commentId: string): Promise<LearningCommentView> {
  return apiFetch<LearningCommentView>(`${BASE}/${resourceId}/comments/${commentId}/hide`, { method: "POST" });
}

export function unhideLearningComment(resourceId: string, commentId: string): Promise<LearningCommentView> {
  return apiFetch<LearningCommentView>(`${BASE}/${resourceId}/comments/${commentId}/unhide`, { method: "POST" });
}

export function deleteLearningComment(resourceId: string, commentId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${resourceId}/comments/${commentId}`, { method: "DELETE" });
}

export function setLearningResourceCommentsEnabled(
  resourceId: string,
  enabled: boolean,
): Promise<LearningResourceView> {
  return apiFetch<LearningResourceView>(`${BASE}/${resourceId}/comments-enabled`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

/** The class roster joined against each student's own interaction (Phase 35H) - one batched read, never one lookup per student. */
export function getLearningResourceCompletions(resourceId: string): Promise<ResourceCompletionsView> {
  return apiFetch<ResourceCompletionsView>(`${BASE}/${resourceId}/completions`);
}

/**
 * Already-uploaded files of `resourceType`, deduped one row per file, across the whole level
 * `classId`+`subjectId` resolve to (any class, any term/session, the caller's own branch scope) -
 * Phase 35K. `resourceType` must be file-backed (`PDF`/`AUDIO`/`VIDEO`); the backend 422s otherwise.
 */
export function listLearningGalleryFiles(params: {
  classId: string;
  subjectId: string;
  resourceType: LearningResourceType;
  search?: string;
  page?: number;
  size?: number;
}): Promise<Page<LearningGalleryFileView>> {
  const query = new URLSearchParams({
    classId: params.classId,
    subjectId: params.subjectId,
    resourceType: params.resourceType,
    page: String(params.page ?? 0),
    size: String(params.size ?? 10),
  });
  if (params.search) query.set("search", params.search);
  return apiFetch<Page<LearningGalleryFileView>>(`${BASE}/gallery?${query.toString()}`);
}

const ME_BASE = "/api/v1/me/learning-resources";

/** The calling STUDENT's own published resources for their class+current term, optionally narrowed to one subject. */
export function listMyLearningResources(subjectId?: string): Promise<MyLearningResourceSummaryView[]> {
  const query = subjectId ? `?subjectId=${subjectId}` : "";
  return apiFetch<MyLearningResourceSummaryView[]>(`${ME_BASE}${query}`);
}

export function getMyLearningResource(resourceId: string): Promise<MyLearningResourceView> {
  return apiFetch<MyLearningResourceView>(`${ME_BASE}/${resourceId}`);
}

/** A file-backed resource's own bytes - never `/api/v1/files/{id}`, which a STUDENT has no access to. */
export function downloadMyLearningResourceFile(resourceId: string): Promise<Blob> {
  return apiFetchBlob(`${ME_BASE}/${resourceId}/file`);
}

/** Like {@link downloadMyLearningResourceFile}, but reports download progress - for a large mp3/mp4 (Phase 35F) whose player shows a determinate progress bar rather than an indeterminate spinner. */
export function downloadMyLearningResourceFileWithProgress(
  resourceId: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<Blob> {
  return apiFetchBlobWithProgress(`${ME_BASE}/${resourceId}/file`, onProgress);
}

// Comments (Phase 35G) - the STUDENT's own post/edit surface. The only posting path this phase;
// staff only moderate, via the functions above.

export function listMyLearningComments(resourceId: string): Promise<LearningCommentView[]> {
  return apiFetch<LearningCommentView[]>(`${ME_BASE}/${resourceId}/comments`);
}

export function postMyLearningComment(resourceId: string, body: string): Promise<LearningCommentView> {
  return apiFetch<LearningCommentView>(`${ME_BASE}/${resourceId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function editMyLearningComment(
  resourceId: string,
  commentId: string,
  body: string,
): Promise<LearningCommentView> {
  return apiFetch<LearningCommentView>(`${ME_BASE}/${resourceId}/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

/**
 * Idempotent partial upsert of the caller's own interaction with `resourceId` (Phase 35H). Both
 * fields of `request` are independently optional - see {@link RecordLearningInteractionRequest}'s
 * own doc comment for the null-means-unchanged rule. An all-omitted body ("I opened this") is
 * legal and only bumps the server's freshness timestamp.
 */
export function recordMyLearningInteraction(
  resourceId: string,
  request: RecordLearningInteractionRequest,
): Promise<MyLearningInteractionView> {
  return apiFetch<MyLearningInteractionView>(`${ME_BASE}/${resourceId}/interaction`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}
