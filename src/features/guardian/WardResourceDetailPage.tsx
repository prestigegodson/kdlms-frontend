import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import type { MyLearningResourceView } from "@/api/learning";
import {
  downloadWardLearningResourceBlob,
  getWardLearningResource,
  getWardLearningResourceMediaUrl,
  wardLearningResourceFilePath,
  wardLearningResourceImagePath,
  wardLearningResourceMediaUrlPath,
} from "@/api/wards";
import { RICH_IMAGE_SIZE_CLASS } from "@/components/richText/richImageSize";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { ResourceViewer } from "@/features/learning/components/ResourceViewer";
import { useMediaStreamUrl } from "@/hooks/useMediaStreamUrl";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { formatDuration } from "@/utils/duration";

const BACK_TO = "/guardian/resources";

/**
 * One of a ward's learning resources, read-only - the shared `ResourceViewer`, fed through the
 * ward-scoped narrow file/media/image endpoints (never `/api/v1/files`). `ClassResourceDetailPage`'s
 * guardian branch: no mark-as-done, no resume-position autosave, no comments - just the ward's own
 * progress as a status line.
 */
export function WardResourceDetailPage() {
  const { studentId = "", resourceId = "" } = useParams<{ studentId: string; resourceId: string }>();
  const [resource, setResource] = useState<MyLearningResourceView | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A new resource resets the stale one during render, not in an effect - the student page's idiom.
  const viewKey = `${studentId}|${resourceId}`;
  const [lastViewKey, setLastViewKey] = useState(viewKey);
  if (viewKey !== lastViewKey) {
    setLastViewKey(viewKey);
    setResource(null);
    setError(null);
  }

  const load = useCallback(() => {
    getWardLearningResource(studentId, resourceId)
      .then(setResource)
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load this resource.")));
  }, [studentId, resourceId]);

  useEffect(load, [load]);

  // A guardian gets an interactive video as its plain underlying video - an uploaded one streams like VIDEO.
  const isMedia =
    resource?.resourceType === "AUDIO" ||
    resource?.resourceType === "VIDEO" ||
    (resource?.resourceType === "INTERACTIVE_VIDEO" && resource.youtubeVideoId == null);
  const pdfUrl = useObjectUrl(
    resource?.resourceType === "PDF" ? wardLearningResourceFilePath(studentId, resourceId) : undefined,
    downloadWardLearningResourceBlob,
  );
  const mediaState = useMediaStreamUrl(
    isMedia ? wardLearningResourceMediaUrlPath(studentId, resourceId) : undefined,
    getWardLearningResourceMediaUrl,
  );
  const renderImage = useCallback(
    (fileId: string, alt: string) => (
      <WardResourceImage studentId={studentId} resourceId={resourceId} fileId={fileId} alt={alt} />
    ),
    [studentId, resourceId],
  );

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resource" backTo={BACK_TO} />
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
  const fileExtension = resource.resourceType === "AUDIO" ? "mp3" : isMedia ? "mp4" : "pdf";

  return (
    <div className="space-y-6">
      <PageHeader title={resource.title} description={description || undefined} backTo={BACK_TO} />
      {resource.description && <p className="text-sm text-slate-600">{resource.description}</p>}

      <div className="rounded-card border border-slate-200 bg-white p-4 text-sm">
        <span className="font-medium text-slate-900">
          {resource.completed ? "Your ward has marked this as done" : "Your ward hasn't marked this as done yet"}
        </span>
      </div>

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
      />
    </div>
  );
}

/** One image in the resource's rich-text body - the ward endpoint serves only files the body references. */
function WardResourceImage({
  studentId,
  resourceId,
  fileId,
  alt,
}: {
  studentId: string;
  resourceId: string;
  fileId: string;
  alt: string;
}) {
  const url = useObjectUrl(wardLearningResourceImagePath(studentId, resourceId, fileId), downloadWardLearningResourceBlob);
  if (!url) {
    return null;
  }
  return <img src={url} alt={alt} className={`my-1 ${RICH_IMAGE_SIZE_CLASS} rounded-control border border-slate-200`} />;
}
