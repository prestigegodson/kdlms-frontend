import { Archive, Pencil, Undo2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { ApiError } from "@/api/client";
import { downloadFile, downloadFileWithProgress } from "@/api/files";
import {
  archiveLearningResource,
  getLearningResource,
  publishLearningResource,
  unpublishLearningResource,
  type LearningResourceView,
} from "@/api/learning";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { ResourceCommentsModeration } from "@/features/learning/components/ResourceCommentsModeration";
import { ResourceEditorModal } from "@/features/learning/components/ResourceEditorModal";
import { ResourceViewer } from "@/features/learning/components/ResourceViewer";
import { LEARNING_RESOURCE_STATUS_VARIANT } from "@/features/learning/learningResourceStatus";
import { useMediaObjectUrl } from "@/hooks/useMediaObjectUrl";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { formatDuration } from "@/utils/duration";

function renderStaffImage(fileId: string, alt: string) {
  return <AuthenticatedRichImage fileId={fileId} alt={alt} />;
}

/**
 * A staff-only, read-only preview of one learning resource - reachable from
 * `LearningResourcesPage`'s row link and its Preview action, for every role that can see the row
 * (`SCHOOL_ADMIN`/`BRANCH_ADMIN`/`TEACHER`, scoped server-side by `LearningResourceAccessGuard` -
 * a 404 for an out-of-scope resource, never a 403). Renders exactly what a student would see
 * (`ResourceViewer`, shared with `StudentResourceDetailPage`), plus the comment-moderation panel
 * and the publish/unpublish/archive/edit actions the list page already offers.
 * <p>
 * Unlike the student viewer, this page fetches a file-backed resource's bytes through the
 * authenticated `GET /api/v1/files/{id}` proxy (`downloadFile`/`downloadFileWithProgress`), not
 * this module's narrow `/me/learning-resources/{id}/file` endpoint - that endpoint exists only
 * because a `STUDENT` may never reach `/api/v1/files/{id}`; staff already can. It also passes
 * `renderImage` into `ResourceViewer`, so a `RICH_TEXT` resource's embedded images render here even
 * though the student viewer deliberately drops them (CLAUDE.md's Domain Rules) - a genuine,
 * intentional asymmetry, not a gap to "fix".
 * <p>
 * There is deliberately no mark-as-done card and no comment composer here - both are a student's
 * own interaction, never staff's (`learning-module.md`'s permissions matrix). There is also
 * deliberately no approval workflow gate on any action here - `learning`'s `DRAFT → PUBLISHED →
 * ARCHIVED` lifecycle has no review step, unlike `lessonnote`.
 */
export function LearningResourcePreviewPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.onDemandLearning);
  const learningMedia = useFeatureStore((state) => state.learningMedia);
  const canAuthorMedia = can.authorLearningMedia(role, entitled, learningMedia);
  const [resource, setResource] = useState<LearningResourceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  // `resourceId` changing resets the stale resource/error during render rather than as a
  // synchronous setState in the effect below - the `StudentResourceDetailPage`/
  // `LearningResourcesPage` lastSelectionKey precedent.
  const [lastResourceId, setLastResourceId] = useState(resourceId);
  if (resourceId !== lastResourceId) {
    setLastResourceId(resourceId);
    setResource(null);
    setError(null);
  }

  function load() {
    if (!resourceId) return;
    getLearningResource(resourceId)
      .then(setResource)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load this resource"));
  }

  useEffect(load, [resourceId]);

  async function runAction(action: (id: string) => Promise<LearningResourceView>) {
    if (!resourceId) return;
    setActionError(null);
    try {
      setResource(await action(resourceId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  const pdfUrl = useObjectUrl(resource?.resourceType === "PDF" ? (resource.fileId ?? undefined) : undefined, downloadFile);
  const isMedia = resource?.resourceType === "AUDIO" || resource?.resourceType === "VIDEO";
  const mediaState = useMediaObjectUrl(
    isMedia ? (resource?.fileId ?? undefined) : undefined,
    downloadFileWithProgress,
  );

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resource" backTo="/school/learning-resources" />
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
  const description = [resource.className, resource.subjectName, duration].filter(Boolean).join(" · ");
  const fileExtension = resource.resourceType === "AUDIO" ? "mp3" : resource.resourceType === "VIDEO" ? "mp4" : "pdf";

  return (
    <div className="space-y-6">
      <PageHeader
        title={resource.title}
        description={description}
        backTo="/school/learning-resources"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={LEARNING_RESOURCE_STATUS_VARIANT[resource.status]}>{resource.status}</Badge>
            {resource.actions.canEdit && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            )}
            {resource.actions.canPublish && (
              <Button variant="accent" onClick={() => runAction(publishLearningResource)}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Publish
              </Button>
            )}
            {resource.actions.canUnpublish && (
              <Button variant="secondary" onClick={() => runAction(unpublishLearningResource)}>
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                Unpublish
              </Button>
            )}
            {resource.actions.canArchive && (
              <Button variant="secondary" onClick={() => setConfirmingArchive(true)}>
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive
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
        renderImage={renderStaffImage}
        fileUrl={resource.resourceType === "PDF" ? pdfUrl : mediaState.url}
        fileError={mediaState.error}
        loadedBytes={mediaState.loadedBytes}
        totalBytes={mediaState.totalBytes}
        downloadName={`${resource.title}.${fileExtension}`}
      />

      <ResourceCommentsModeration resourceId={resource.id} />

      {editing && (
        <ResourceEditorModal
          classId={resource.classId}
          subjectId={resource.subjectId}
          termId={resource.termId}
          subjects={[{ subjectId: resource.subjectId, subjectName: resource.subjectName }]}
          resource={resource}
          canAuthorMedia={canAuthorMedia}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}

      {confirmingArchive && (
        <ConfirmDialog
          title="Archive this resource?"
          message={
            <>
              <strong>{resource.title}</strong> will be archived and hidden from students. This can't be undone.
            </>
          }
          confirmLabel="Archive"
          variant="danger"
          onConfirm={async () => {
            await runAction(archiveLearningResource);
            setConfirmingArchive(false);
          }}
          onClose={() => setConfirmingArchive(false)}
        />
      )}
    </div>
  );
}
