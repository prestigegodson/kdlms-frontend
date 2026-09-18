import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { ApiError } from "@/api/client";
import {
  downloadMyLearningResourceFile,
  downloadMyLearningResourceFileWithProgress,
  editMyLearningComment,
  getMyLearningResource,
  listMyLearningComments,
  postMyLearningComment,
  recordMyLearningInteraction,
  type LearningCommentView,
  type MyLearningResourceView,
} from "@/api/learning";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { CommentsPanel } from "@/features/learning/components/CommentsPanel";
import { ResourceViewer } from "@/features/learning/components/ResourceViewer";
import { useMediaObjectUrl } from "@/hooks/useMediaObjectUrl";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { useThrottledSave } from "@/hooks/useThrottledSave";
import { formatInstant } from "@/utils/date";
import { formatDuration } from "@/utils/duration";

/**
 * The student portal's own read of one published resource (Phase 35E; `AUDIO`/`VIDEO` added Phase
 * 35F). Delegates the actual payload rendering to `ResourceViewer` (shared with the staff preview,
 * `LearningResourcePreviewPage`), passing no `renderImage` - a student has no access to
 * `/api/v1/files/{id}` at all (CLAUDE.md's Domain Rules), so an embedded rich-text image is
 * silently dropped rather than 403ing the whole note, the guardian document-mode-note precedent.
 * `PDF`/`AUDIO`/`VIDEO` are fed by this resource's own `/file` endpoint (downloads allowed - the
 * locked decision - via a plain `download` link on the already-fetched blob URL); resume-seek and
 * throttled position autosave for `AUDIO`/`VIDEO` are wired through `ResourceViewer`'s optional
 * `onLoadedMetadata`/`onTimeUpdate` callbacks, this page's own responsibility since a resource
 * interaction is a student's own, never staff's.
 */
export function StudentResourceDetailPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const [resource, setResource] = useState<MyLearningResourceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<LearningCommentView[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  // Seeded from `resource.completed` the instant it loads (below), then kept in sync with every
  // interaction PUT's response - the mark-as-done card's own state, decoupled from `resource` so
  // toggling it doesn't need a full resource refetch. `completedAt` is only known once an
  // interaction response has actually carried it (the initial resource read doesn't include it),
  // so it stays null until the first PUT (the opened ping, at the latest) resolves.
  const [completed, setCompleted] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // `resourceId` changing (navigating to a different resource) resets the stale
  // resource/error during render rather than as a synchronous setState in the
  // effect below - the same pattern `useObjectUrl`'s lastKey/`LearningResourcesPage`'s
  // lastSelectionKey document.
  const [lastResourceId, setLastResourceId] = useState(resourceId);
  if (resourceId !== lastResourceId) {
    setLastResourceId(resourceId);
    setResource(null);
    setError(null);
    setComments([]);
    setCommentsError(null);
    setCompleted(false);
    setCompletedAt(null);
    setCompletionError(null);
  }

  function load() {
    if (!resourceId) return;
    getMyLearningResource(resourceId)
      .then((view) => {
        setResource(view);
        setCompleted(view.completed);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load this resource"));
  }

  function loadComments() {
    if (!resourceId) return;
    listMyLearningComments(resourceId)
      .then(setComments)
      .catch((err: unknown) => setCommentsError(err instanceof ApiError ? err.message : "Failed to load comments"));
  }

  useEffect(load, [resourceId]);
  useEffect(loadComments, [resourceId]);

  // Phase 35H: the "opened" ping - an all-omitted body that only bumps the server's own
  // freshness timestamp. Fire-and-forget: a student's ability to read the resource never depends
  // on this succeeding, so a failure is silently swallowed rather than surfaced as a page error.
  // Its response is the first place `completedAt` becomes known (the resource read above doesn't
  // carry it), so it also refreshes `completed` in case it's since changed on another device.
  useEffect(() => {
    if (!resourceId) return;
    recordMyLearningInteraction(resourceId, {})
      .then((view) => {
        setCompleted(view.completed);
        setCompletedAt(view.completedAt);
      })
      .catch(() => {
        // Best-effort - see this effect's own comment above.
      });
  }, [resourceId]);

  async function handlePostComment(body: string) {
    if (!resourceId) return;
    await postMyLearningComment(resourceId, body);
    loadComments();
  }

  async function handleEditComment(commentId: string, body: string) {
    if (!resourceId) return;
    await editMyLearningComment(resourceId, commentId, body);
    loadComments();
  }

  async function handleToggleCompleted() {
    if (!resourceId) return;
    setCompletionError(null);
    try {
      const view = await recordMyLearningInteraction(resourceId, { completed: !completed });
      setCompleted(view.completed);
      setCompletedAt(view.completedAt);
    } catch (err) {
      setCompletionError(err instanceof ApiError ? err.message : "Failed to update completion status");
    }
  }

  const pdfUrl = useObjectUrl(
    resource?.resourceType === "PDF" ? resourceId : undefined,
    downloadMyLearningResourceFile,
  );
  const mediaState = useMediaObjectUrl(
    resource?.resourceType === "AUDIO" || resource?.resourceType === "VIDEO" ? resourceId : undefined,
    downloadMyLearningResourceFileWithProgress,
  );

  // Phase 35H: the resume-position autosave (~15s throttle) via `recordMyLearningInteraction` - a
  // `completed: null` (omitted) partial update, so a position ping can never flip the
  // mark-as-done state. Best-effort: a dropped ping just means resume starts a little earlier next
  // time, never an error surfaced to the student. The last pending position is flushed on
  // unmount, so navigating away mid-scrub doesn't lose the last few seconds - `useThrottledSave`
  // deliberately doesn't auto-flush itself, since only this caller knows a pending position is
  // still worth persisting.
  const { schedule: schedulePosition, flush: flushPosition } = useThrottledSave<number>({
    onSave: (positionSeconds) => {
      if (!resourceId) return;
      recordMyLearningInteraction(resourceId, { positionSeconds }).catch(() => {});
    },
  });
  useEffect(() => {
    return () => flushPosition();
  }, [flushPosition]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resource" />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  const duration = formatDuration(resource.durationSeconds);
  const description = duration ? `${resource.subjectName} · ${duration}` : resource.subjectName;
  const fileExtension = resource.resourceType === "AUDIO" ? "mp3" : resource.resourceType === "VIDEO" ? "mp4" : "pdf";

  return (
    <div className="space-y-6">
      <PageHeader title={resource.title} description={description} />
      {resource.description && <p className="text-sm text-slate-600">{resource.description}</p>}

      <ResourceViewer
        resourceType={resource.resourceType}
        title={resource.title}
        bodyHtml={resource.bodyHtml}
        youtubeVideoId={resource.youtubeVideoId}
        fileUrl={resource.resourceType === "PDF" ? pdfUrl : mediaState.url}
        fileError={mediaState.error}
        loadedBytes={mediaState.loadedBytes}
        totalBytes={mediaState.totalBytes ?? resource.fileSizeBytes}
        downloadName={`${resource.title}.${fileExtension}`}
        initialPositionSeconds={resource.positionSeconds}
        onTimeUpdate={schedulePosition}
      />

      <div className="flex items-center justify-between gap-4 rounded-card border border-slate-200 bg-white p-5">
        <div>
          <p className="font-medium text-slate-900">{completed ? "Completed" : "Not yet completed"}</p>
          {completed && completedAt && (
            <p className="text-xs text-slate-500">Marked done {formatInstant(completedAt)}</p>
          )}
          {completionError && <p className="mt-1 text-xs text-red-600">{completionError}</p>}
        </div>
        <Button variant={completed ? "secondary" : "accent"} onClick={handleToggleCompleted}>
          {completed ? "Mark as not done" : "Mark as done"}
        </Button>
      </div>

      {commentsError ? (
        <Alert variant="error">{commentsError}</Alert>
      ) : (
        <CommentsPanel
          comments={comments}
          commentsEnabled={resource.commentsEnabled}
          canPost
          onPost={handlePostComment}
          onEdit={handleEditComment}
        />
      )}
    </div>
  );
}
