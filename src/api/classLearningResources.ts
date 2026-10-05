import { apiFetch, apiFetchBlob, apiFetchBlobWithProgress, type DownloadProgress } from "@/api/client";
import type {
  LearningGalleryFileView,
  LearningResourceActionsView,
  LearningResourceStatus,
  LearningResourceSummaryView,
  LearningResourceType,
  MyLearningInteractionView,
  MyLearningResourceSummaryView,
  MyLearningResourceView,
  RecordLearningInteractionRequest,
} from "@/api/learning";
import type { Page } from "@/api/types";

/**
 * An education creator's learning resources for one virtual class, and a learner's/guardian's side
 * of them (creators Phase C14). The summary, detail, gallery and interaction shapes are the school
 * module's own, so the shared viewer and editor components work unchanged; a class resource has no
 * subject/term and no comments.
 */

// ---- creator ----

/** Mirrors backend `CreatorLearningResourcesUseCase.ClassResourceListView`. `writable` is false for an archived or over-limit class. */
export interface ClassResourceListView {
  classId: string;
  className: string;
  writable: boolean;
  /** Whether the creator's plan includes audio/video (`LEARNING_MEDIA`) - without it, media resources are left out of `resources`. */
  mediaIncluded: boolean;
  /** `subjectName` is the class's own subject label. */
  resources: LearningResourceSummaryView[];
}

/** Mirrors backend `CreatorLearningResourcesUseCase.ClassLearningResourceView` - the creator's full detail. */
export interface ClassLearningResourceView {
  id: string;
  classId: string;
  className: string;
  title: string;
  description: string | null;
  resourceType: LearningResourceType;
  bodyHtml: string | null;
  fileId: string | null;
  youtubeVideoId: string | null;
  durationSeconds: number | null;
  status: LearningResourceStatus;
  position: number;
  availableFrom: string | null;
  availableUntil: string | null;
  actions: LearningResourceActionsView;
  updatedAt: string;
}

/** Mirrors backend `CreatorLearningResourceController.SaveClassResourceRequest`. `resourceType` is required on create and ignored on update. */
export interface SaveClassResourceRequest {
  title: string;
  description: string | null;
  resourceType?: LearningResourceType;
  bodyHtml: string | null;
  fileId: string | null;
  youtubeUrl: string | null;
  durationSeconds: number | null;
  availableFrom: string | null;
  availableUntil: string | null;
}

/** One row of {@link ClassResourceCompletionsView}. The three timestamps/position are null until the learner opens it. */
export interface LearnerCompletionView {
  learnerId: string;
  learnerName: string;
  completed: boolean;
  completedAt: string | null;
  positionSeconds: number | null;
  lastOpenedAt: string | null;
}

/** Mirrors backend `ClassResourceCompletionsView` - the class's active members against one resource. */
export interface ClassResourceCompletionsView {
  resourceId: string;
  title: string;
  totalLearners: number;
  completedCount: number;
  learners: LearnerCompletionView[];
}

function creatorBase(classId: string): string {
  return `/api/v1/virtual-classes/${classId}/learning-resources`;
}

export function listClassResources(classId: string, status?: LearningResourceStatus): Promise<ClassResourceListView> {
  const query = status ? `?status=${status}` : "";
  return apiFetch<ClassResourceListView>(`${creatorBase(classId)}${query}`);
}

export function getClassResource(classId: string, resourceId: string): Promise<ClassLearningResourceView> {
  return apiFetch<ClassLearningResourceView>(`${creatorBase(classId)}/${resourceId}`);
}

export function createClassResource(
  classId: string,
  request: SaveClassResourceRequest,
): Promise<ClassLearningResourceView> {
  return apiFetch<ClassLearningResourceView>(creatorBase(classId), {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function updateClassResource(
  classId: string,
  resourceId: string,
  request: SaveClassResourceRequest,
): Promise<ClassLearningResourceView> {
  return apiFetch<ClassLearningResourceView>(`${creatorBase(classId)}/${resourceId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function publishClassResource(classId: string, resourceId: string): Promise<ClassLearningResourceView> {
  return apiFetch<ClassLearningResourceView>(`${creatorBase(classId)}/${resourceId}/publish`, { method: "POST" });
}

export function unpublishClassResource(classId: string, resourceId: string): Promise<ClassLearningResourceView> {
  return apiFetch<ClassLearningResourceView>(`${creatorBase(classId)}/${resourceId}/unpublish`, { method: "POST" });
}

export function archiveClassResource(classId: string, resourceId: string): Promise<ClassLearningResourceView> {
  return apiFetch<ClassLearningResourceView>(`${creatorBase(classId)}/${resourceId}/archive`, { method: "POST" });
}

export function deleteClassResource(classId: string, resourceId: string): Promise<void> {
  return apiFetch<void>(`${creatorBase(classId)}/${resourceId}`, { method: "DELETE" });
}

/** Refused unless `orderedResourceIds` lists exactly the class's resources. */
export function reorderClassResources(
  classId: string,
  orderedResourceIds: string[],
): Promise<LearningResourceSummaryView[]> {
  return apiFetch<LearningResourceSummaryView[]>(`${creatorBase(classId)}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ orderedResourceIds }),
  });
}

/** Files already attached to any of the creator's class resources, deduped per file - `classId` only authorizes the call. */
export function listClassGalleryFiles(params: {
  classId: string;
  resourceType: LearningResourceType;
  search?: string;
  page?: number;
  size?: number;
}): Promise<Page<LearningGalleryFileView>> {
  const query = new URLSearchParams({
    resourceType: params.resourceType,
    page: String(params.page ?? 0),
    size: String(params.size ?? 10),
  });
  if (params.search) query.set("search", params.search);
  return apiFetch<Page<LearningGalleryFileView>>(`${creatorBase(params.classId)}/gallery?${query.toString()}`);
}

export function getClassResourceCompletions(
  classId: string,
  resourceId: string,
): Promise<ClassResourceCompletionsView> {
  return apiFetch<ClassResourceCompletionsView>(`${creatorBase(classId)}/${resourceId}/completions`);
}

// ---- learner / guardian ----

/** Who's reading: a learner reads their own class (`learnerId` absent); a guardian names the learner they follow. */
export interface ClassResourceReader {
  classId: string;
  learnerId?: string;
}

/** Mirrors backend `ClassMemberLearningResourcesUseCase.ClassMemberResourceListView`. `subjectName` on each row is the class's own subject label. */
export interface ClassMemberResourceListView {
  classId: string;
  className: string;
  resources: MyLearningResourceSummaryView[];
}

function readerBase({ classId, learnerId }: ClassResourceReader): string {
  return learnerId
    ? `/api/v1/me/online-classes/${learnerId}/classes/${classId}/learning-resources`
    : `/api/v1/learner/classes/${classId}/learning-resources`;
}

export function listMemberClassResources(reader: ClassResourceReader): Promise<ClassMemberResourceListView> {
  return apiFetch<ClassMemberResourceListView>(readerBase(reader));
}

/** `completed`/`positionSeconds` are the learner's own; always false/null for a guardian. */
export function getMemberClassResource(reader: ClassResourceReader, resourceId: string): Promise<MyLearningResourceView> {
  return apiFetch<MyLearningResourceView>(`${readerBase(reader)}/${resourceId}`);
}

/** A file-backed resource's narrow file endpoint - the `useObjectUrl`/`useMediaObjectUrl` key its bytes are fetched under. */
export function classResourceFilePath(reader: ClassResourceReader, resourceId: string): string {
  return `${readerBase(reader)}/${resourceId}/file`;
}

/** Fetches a PDF by its {@link classResourceFilePath} - never `/api/v1/files`, which learners and guardians can't reach. */
export function downloadClassResourceFile(path: string): Promise<Blob> {
  return apiFetchBlob(path);
}

/** Like {@link downloadClassResourceFile}, reporting progress for a large mp3/mp4. */
export function downloadClassResourceFileWithProgress(
  path: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<Blob> {
  return apiFetchBlobWithProgress(path, onProgress);
}

/** The `useObjectUrl` key an embedded image is fetched under - one per (reader, resource, image). */
export function classResourceImagePath(reader: ClassResourceReader, resourceId: string, fileId: string): string {
  return `${readerBase(reader)}/${resourceId}/images/${fileId}`;
}

/** An image embedded in a rich-text resource - served only if the published body references it. */
export function downloadClassResourceImage(path: string): Promise<Blob> {
  return apiFetchBlob(path);
}

/** The learner's own mark-as-done / resume position - `LEARNER` only; omitted fields are left unchanged. */
export function recordLearnerClassResourceInteraction(
  classId: string,
  resourceId: string,
  request: RecordLearningInteractionRequest,
): Promise<MyLearningInteractionView> {
  return apiFetch<MyLearningInteractionView>(
    `/api/v1/learner/classes/${classId}/learning-resources/${resourceId}/interaction`,
    { method: "PUT", body: JSON.stringify(request) },
  );
}
