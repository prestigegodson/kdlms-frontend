import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type ClassResourceReader,
  classResourceFilePath,
  downloadClassResourceFile,
  classResourceMediaUrlPath,
  getClassResourceMediaUrl,
  getMemberClassResource,
  recordLearnerClassResourceInteraction,
} from "@/api/classLearningResources";
import type { MyLearningResourceView } from "@/api/learning";
import { can } from "@/auth/permissions";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { ClassResourceImage } from "@/features/learning/classMember/ClassResourceImage";
import type { ClassResourcesAudience } from "@/features/learning/classMember/ClassResourcesPage";
import { ResourceViewer } from "@/features/learning/components/ResourceViewer";
import { useMediaStreamUrl } from "@/hooks/useMediaStreamUrl";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { useThrottledSave } from "@/hooks/useThrottledSave";
import { formatInstant } from "@/utils/date";
import { formatDuration } from "@/utils/duration";

/**
 * One class resource, for a learner or a minor's guardian (creators Phase C14) - the shared
 * `ResourceViewer`, fed through the resource's own narrow file and image endpoints (never
 * `/api/v1/files`). A learner also gets the mark-as-done card and, for audio/video, the throttled
 * resume-position autosave - the `StudentResourceDetailPage` behaviour; a guardian only reads.
 */
export function ClassResourceDetailPage({ audience }: { audience: ClassResourcesAudience }) {
  const { classId = "", learnerId, resourceId = "" } = useParams<{
    classId: string;
    learnerId?: string;
    resourceId: string;
  }>();
  const reader: ClassResourceReader = useMemo(
    () => ({ classId, learnerId: audience === "GUARDIAN" ? learnerId : undefined }),
    [audience, classId, learnerId],
  );
  const tracksProgress = can.trackClassResources(audience);
  const backTo =
    audience === "GUARDIAN"
      ? `/guardian/class-resources?classId=${classId}&learnerId=${learnerId ?? ""}`
      : `/learner/resources?classId=${classId}`;

  const [resource, setResource] = useState<MyLearningResourceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // A new resource resets the stale one during render, not in an effect - the student page's idiom.
  const viewKey = `${classId}|${learnerId ?? ""}|${resourceId}`;
  const [lastViewKey, setLastViewKey] = useState(viewKey);
  if (viewKey !== lastViewKey) {
    setLastViewKey(viewKey);
    setResource(null);
    setError(null);
    setCompleted(false);
    setCompletedAt(null);
    setCompletionError(null);
  }

  const load = useCallback(() => {
    getMemberClassResource(reader, resourceId)
      .then((view) => {
        setResource(view);
        setCompleted(view.completed);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load this resource.")));
  }, [reader, resourceId]);

  useEffect(load, [load]);

  // The learner's "opened" ping - best-effort, and the first place `completedAt` becomes known.
  useEffect(() => {
    if (!tracksProgress) return;
    recordLearnerClassResourceInteraction(classId, resourceId, {})
      .then((view) => {
        setCompleted(view.completed);
        setCompletedAt(view.completedAt);
      })
      .catch(() => {
        // Reading never depends on this succeeding (an over-limit place refuses the write).
      });
  }, [tracksProgress, classId, resourceId]);

  async function handleToggleCompleted() {
    setCompletionError(null);
    try {
      const view = await recordLearnerClassResourceInteraction(classId, resourceId, { completed: !completed });
      setCompleted(view.completed);
      setCompletedAt(view.completedAt);
    } catch (err) {
      setCompletionError(getErrorMessage(err, "We couldn't update this. Please try again."));
    }
  }

  // The resume-position autosave - best-effort; the last pending position is flushed on unmount.
  const { schedule: schedulePosition, flush: flushPosition } = useThrottledSave<number>({
    onSave: (positionSeconds) => {
      recordLearnerClassResourceInteraction(classId, resourceId, { positionSeconds }).catch(() => {});
    },
  });
  useEffect(() => {
    return () => flushPosition();
  }, [flushPosition]);

  const filePath = classResourceFilePath(reader, resourceId);
  const isMedia = resource?.resourceType === "AUDIO" || resource?.resourceType === "VIDEO";
  const pdfUrl = useObjectUrl(resource?.resourceType === "PDF" ? filePath : undefined, downloadClassResourceFile);
  const mediaState = useMediaStreamUrl(
    isMedia ? classResourceMediaUrlPath(reader, resourceId) : undefined,
    getClassResourceMediaUrl,
  );
  const renderImage = useCallback(
    (fileId: string, alt: string) => (
      <ClassResourceImage reader={reader} resourceId={resourceId} fileId={fileId} alt={alt} />
    ),
    [reader, resourceId],
  );

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resource" backTo={backTo} />
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

  const description = [resource.subjectName, formatDuration(resource.durationSeconds)].filter(Boolean).join(" · ");
  const fileExtension = resource.resourceType === "AUDIO" ? "mp3" : resource.resourceType === "VIDEO" ? "mp4" : "pdf";

  return (
    <div className="space-y-6">
      <PageHeader title={resource.title} description={description || undefined} backTo={backTo} />
      {resource.description && <p className="text-sm text-slate-600">{resource.description}</p>}

      <ResourceViewer
        resourceType={resource.resourceType}
        title={resource.title}
        bodyHtml={resource.bodyHtml}
        youtubeVideoId={resource.youtubeVideoId}
        renderImage={renderImage}
        fileUrl={resource.resourceType === "PDF" ? pdfUrl : mediaState.url}
        fileError={mediaState.error}
        onMediaUrlExpired={mediaState.refresh}
        downloadName={`${resource.title}.${fileExtension}`}
        initialPositionSeconds={tracksProgress ? resource.positionSeconds : undefined}
        onTimeUpdate={tracksProgress ? schedulePosition : undefined}
      />

      {tracksProgress && (
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
      )}
    </div>
  );
}
