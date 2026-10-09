import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  deleteLearningComment,
  editLearningComment,
  getLearningResource,
  hideLearningComment,
  listLearningComments,
  postLearningComment,
  setLearningResourceCommentsEnabled,
  unhideLearningComment,
  type LearningCommentView,
  type LearningResourceView,
} from "@/api/learning";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Checkbox } from "@/components/ui/Checkbox";
import { Spinner } from "@/components/ui/Spinner";
import { CommentsPanel } from "@/features/learning/components/CommentsPanel";
import { useAuthStore } from "@/stores/authStore";

interface ResourceCommentsModerationProps {
  resourceId: string;
  /** Fires once the resource resolves (and again after any hide/unhide/delete refresh) - lets a caller with no other reason to fetch the resource itself (`CommentsModal`) read its title without a second, redundant `getLearningResource` round-trip. */
  onResourceLoaded?: (resource: LearningResourceView) => void;
}

/**
 * The staff side of a resource's discussion (Phase 35G): resolve the resource (for
 * `commentsEnabled` and its toggle) and its comments before rendering anything real, then wrap the
 * same `CommentsPanel` the student resource detail page renders, with the moderation actions
 * (`onHide`/`onUnhide`/`onDelete`) and - for a TEACHER only, `can.postLearningComments` - the
 * composer and Reply buttons too. Admins moderate but never post. Extracted from
 * `CommentsModal` so it can be embedded directly on `LearningResourcePreviewPage` as well as
 * inside `CommentsModal`'s own modal chrome - the two callers differ only in layout.
 */
export function ResourceCommentsModeration({ resourceId, onResourceLoaded }: ResourceCommentsModerationProps) {
  const [resource, setResource] = useState<LearningResourceView | null>(null);
  const [comments, setComments] = useState<LearningCommentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [togglingComments, setTogglingComments] = useState(false);
  const role = useAuthStore((state) => state.user?.role);

  function load() {
    Promise.all([getLearningResource(resourceId), listLearningComments(resourceId)])
      .then(([resourceView, commentList]) => {
        setResource(resourceView);
        setComments(commentList);
        onResourceLoaded?.(resourceView);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load comments"));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetching keys off resourceId alone; onResourceLoaded is an inline callback at the CommentsModal call site and isn't itself a reason to reload
  useEffect(load, [resourceId]);

  async function handlePost(body: string, parentCommentId?: string) {
    await postLearningComment(resourceId, body, parentCommentId);
    load();
  }

  async function handleEdit(commentId: string, body: string) {
    await editLearningComment(resourceId, commentId, body);
    load();
  }

  async function handleHide(commentId: string) {
    await hideLearningComment(resourceId, commentId);
    load();
  }

  async function handleUnhide(commentId: string) {
    await unhideLearningComment(resourceId, commentId);
    load();
  }

  async function handleDelete(commentId: string) {
    await deleteLearningComment(resourceId, commentId);
    load();
  }

  async function handleToggleCommentsEnabled(enabled: boolean) {
    setTogglingComments(true);
    setToggleError(null);
    try {
      const updated = await setLearningResourceCommentsEnabled(resourceId, enabled);
      setResource(updated);
    } catch (err) {
      setToggleError(err instanceof ApiError ? err.message : "Could not update the comments setting");
    } finally {
      setTogglingComments(false);
    }
  }

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  if (!resource || comments === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox
          checked={resource.commentsEnabled}
          disabled={togglingComments}
          onChange={(event) => handleToggleCommentsEnabled(event.target.checked)}
        />
        Comments enabled
      </label>
      {toggleError && <Alert variant="error">{toggleError}</Alert>}

      <CommentsPanel
        comments={comments}
        commentsEnabled={resource.commentsEnabled}
        // The resource and its comments only load for an entitled school, so entitlement holds here.
        canPost={can.postLearningComments(role, true)}
        onPost={handlePost}
        onEdit={handleEdit}
        onHide={handleHide}
        onUnhide={handleUnhide}
        onDelete={handleDelete}
      />
    </div>
  );
}
