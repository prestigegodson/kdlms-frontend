import { Undo2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type ClassLearningResourceView,
  getClassResource,
  publishClassResource,
  unpublishClassResource,
} from "@/api/classLearningResources";
import { downloadFile, getFileMediaUrl } from "@/api/files";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { ResourceViewer } from "@/features/learning/components/ResourceViewer";
import { LEARNING_RESOURCE_STATUS_VARIANT } from "@/features/learning/learningResourceStatus";
import { useMediaStreamUrl } from "@/hooks/useMediaStreamUrl";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { formatDuration } from "@/utils/duration";

function renderCreatorImage(fileId: string, alt: string) {
  return <AuthenticatedRichImage fileId={fileId} alt={alt} />;
}

/**
 * A creator's preview of one class resource (creators Phase C14) - exactly what learners see
 * (`ResourceViewer`), plus Publish/Unpublish. A creator reads their own tenant's files through
 * `/api/v1/files` (Phase C12), so this fetches by `fileId` like the school preview page does;
 * editing, reordering and archiving stay on the Resources list.
 */
export function CreatorResourcePreviewPage() {
  const { classId = "", resourceId = "" } = useParams<{ classId: string; resourceId: string }>();
  const [resource, setResource] = useState<ClassLearningResourceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const backTo = `/creator/resources?classId=${classId}`;

  const load = useCallback(() => {
    getClassResource(classId, resourceId)
      .then(setResource)
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load this resource.")));
  }, [classId, resourceId]);

  useEffect(load, [load]);

  async function runAction(action: (classId: string, resourceId: string) => Promise<ClassLearningResourceView>) {
    setActionError(null);
    try {
      setResource(await action(classId, resourceId));
    } catch (err) {
      setActionError(getErrorMessage(err, "That didn't work. Please try again."));
    }
  }

  const isMedia = resource?.resourceType === "AUDIO" || resource?.resourceType === "VIDEO";
  const pdfUrl = useObjectUrl(resource?.resourceType === "PDF" ? (resource.fileId ?? undefined) : undefined, downloadFile);
  const mediaState = useMediaStreamUrl(isMedia ? (resource?.fileId ?? undefined) : undefined, getFileMediaUrl);

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

  const description = [resource.className, formatDuration(resource.durationSeconds)].filter(Boolean).join(" · ");
  const fileExtension = resource.resourceType === "AUDIO" ? "mp3" : resource.resourceType === "VIDEO" ? "mp4" : "pdf";

  return (
    <div className="space-y-6">
      <PageHeader
        title={resource.title}
        description={description}
        backTo={backTo}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={LEARNING_RESOURCE_STATUS_VARIANT[resource.status]}>{resource.status}</Badge>
            {resource.actions.canPublish && (
              <Button variant="accent" onClick={() => runAction(publishClassResource)}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Publish
              </Button>
            )}
            {resource.actions.canUnpublish && (
              <Button variant="secondary" onClick={() => runAction(unpublishClassResource)}>
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                Unpublish
              </Button>
            )}
          </div>
        }
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}
      {resource.description && <p className="text-sm text-slate-600">{resource.description}</p>}

      <ResourceViewer
        resourceType={resource.resourceType}
        title={resource.title}
        bodyHtml={resource.bodyHtml}
        youtubeVideoId={resource.youtubeVideoId}
        renderImage={renderCreatorImage}
        fileUrl={resource.resourceType === "PDF" ? pdfUrl : mediaState.url}
        fileError={mediaState.error}
        onMediaUrlExpired={mediaState.refresh}
        downloadName={`${resource.title}.${fileExtension}`}
      />
    </div>
  );
}
