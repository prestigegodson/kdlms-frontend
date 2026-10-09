import { PencilLine, Reply } from "lucide-react";
import { useState } from "react";
import type { LearningCommentView } from "@/api/learning";
import { ApiError, getErrorMessage } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { formatInstant } from "@/utils/date";

const RATE_LIMIT_PROBLEM_TYPE = "https://kdlms.com/problems/too-many-requests";
const MAX_COMMENT_LENGTH = 2000;

/** As {@link getErrorMessage}, but with this panel's own friendlier copy for the rate-limit problem type. */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.problem?.type === RATE_LIMIT_PROBLEM_TYPE) {
    return "You've posted too many comments recently - please wait a while and try again.";
  }
  return getErrorMessage(error, fallback);
}

interface CommentsPanelProps {
  comments: LearningCommentView[];
  commentsEnabled: boolean;
  /** The caller may post and reply (a student, or a teacher) - the composer and Reply buttons render only when this and `commentsEnabled` are both true. */
  canPost: boolean;
  /** A top-level comment when `parentCommentId` is omitted, else a reply to it. */
  onPost?: (body: string, parentCommentId?: string) => Promise<void>;
  onEdit?: (commentId: string, body: string) => Promise<void>;
  /** Staff mode - present only for the moderation surface. */
  onHide?: (commentId: string) => Promise<void>;
  onUnhide?: (commentId: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
}

/**
 * A resource's class-wide discussion - shared between the student resource detail page
 * (`canPost`, `onPost`/`onEdit`) and the staff surface (`onHide`/`onUnhide`/`onDelete`, plus
 * `onPost`/`onEdit` for a teacher), the `ThreadCard` reuse pattern. The server sends a flat list,
 * oldest first; replies (one level deep) are nested under their top-level comment here: every per-comment affordance (`canEdit`/
 * `canModerate`/`hidden`) is server-derived, so this component never re-derives permission or
 * role from who's viewing it. Body is always rendered as a plain React text child - no
 * `RichContent`, no `dangerouslySetInnerHTML` - the entire XSS argument for a comment (see the
 * backend's `learning.domain.LearningComment`).
 */
export function CommentsPanel({
  comments,
  commentsEnabled,
  canPost,
  onPost,
  onEdit,
  onHide,
  onUnhide,
  onDelete,
}: CommentsPanelProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const { topLevel, repliesByParent } = groupThreads(comments);
  const canReply = commentsEnabled && canPost && onPost !== undefined;

  function rowFor(comment: LearningCommentView, onReply?: () => void) {
    return (
      <CommentRow
        comment={comment}
        onReply={onReply}
        onEdit={onEdit ? (body) => onEdit(comment.commentId, body) : undefined}
        onHide={onHide ? () => onHide(comment.commentId) : undefined}
        onUnhide={onUnhide ? () => onUnhide(comment.commentId) : undefined}
        onDelete={onDelete ? () => onDelete(comment.commentId) : undefined}
      />
    );
  }

  return (
    <div className="rounded-card border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Comments</h2>

      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No comments yet.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {topLevel.map((comment) => {
            const replies = repliesByParent.get(comment.commentId) ?? [];
            return (
              <div key={comment.commentId}>
                {rowFor(
                  comment,
                  canReply && !comment.hidden && replyingTo !== comment.commentId
                    ? () => setReplyingTo(comment.commentId)
                    : undefined,
                )}
                {(replies.length > 0 || replyingTo === comment.commentId) && (
                  <div className="ml-6 mt-3 space-y-3 border-l border-slate-200 pl-4">
                    {replies.map((reply) => (
                      <div key={reply.commentId}>{rowFor(reply)}</div>
                    ))}
                    {canReply && replyingTo === comment.commentId && (
                      <Composer
                        placeholder="Write a reply…"
                        submitLabel="Reply"
                        onPost={async (body) => {
                          await onPost(body, comment.commentId);
                          setReplyingTo(null);
                        }}
                        onCancel={() => setReplyingTo(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canReply ? (
        <Composer docked onPost={(body) => onPost(body)} />
      ) : (
        !commentsEnabled && <p className="mt-4 text-sm text-slate-500">Comments are turned off for this resource.</p>
      )}
    </div>
  );
}

/**
 * Splits the server's flat, oldest-first list into top-level comments and their replies. A reply
 * whose parent isn't in the list (the server filters those out, so this shouldn't happen) is shown
 * as top-level rather than dropped.
 */
function groupThreads(comments: LearningCommentView[]) {
  const ids = new Set(comments.map((comment) => comment.commentId));
  const topLevel: LearningCommentView[] = [];
  const repliesByParent = new Map<string, LearningCommentView[]>();
  for (const comment of comments) {
    if (comment.parentCommentId && ids.has(comment.parentCommentId)) {
      const replies = repliesByParent.get(comment.parentCommentId) ?? [];
      replies.push(comment);
      repliesByParent.set(comment.parentCommentId, replies);
    } else {
      topLevel.push(comment);
    }
  }
  return { topLevel, repliesByParent };
}

interface CommentRowProps {
  comment: LearningCommentView;
  /** Present on a top-level row when the caller may reply - opens the inline reply composer. */
  onReply?: () => void;
  onEdit?: (body: string) => Promise<void>;
  onHide?: () => Promise<void>;
  onUnhide?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

function CommentRow({ comment, onReply, onEdit, onHide, onUnhide, onDelete }: CommentRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!onEdit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onEdit(draft);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, "Could not save your edit"));
    } finally {
      setSubmitting(false);
    }
  }

  async function moderate(action: () => Promise<void>, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, "Action failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-slate-900">{comment.authorName}</span>
        {comment.authorRole === "TEACHER" && <Badge variant="brand">Teacher</Badge>}
        {comment.hidden && <Badge variant="warning">Hidden</Badge>}
        <span className="text-slate-400">{formatInstant(comment.createdAt)}</span>
        {comment.editedAt && <span className="text-xs text-slate-400">(edited)</span>}
        <div className="ml-auto flex items-center gap-3">
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800"
            >
              <Reply className="h-3.5 w-3.5" aria-hidden="true" />
              Reply
            </button>
          )}
          {comment.canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800"
            >
              <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </button>
          )}
          {comment.canModerate && !comment.hidden && onHide && (
            <button
              type="button"
              onClick={() => moderate(onHide)}
              disabled={submitting}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Hide
            </button>
          )}
          {comment.canModerate && comment.hidden && onUnhide && (
            <button
              type="button"
              onClick={() => moderate(onUnhide)}
              disabled={submitting}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Unhide
            </button>
          )}
          {comment.canModerate && onDelete && (
            <button
              type="button"
              onClick={() => moderate(onDelete, "Delete this comment? This can't be undone.")}
              disabled={submitting}
              className="text-xs font-medium text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={MAX_COMMENT_LENGTH}
          />
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={submitting} disabled={!draft.trim()}>
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setDraft(comment.body);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
          {error && (
            <div className="mt-2">
              <Alert variant="error">{error}</Alert>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ComposerProps {
  onPost: (body: string) => Promise<void>;
  placeholder?: string;
  submitLabel?: string;
  /** Shows a Cancel button - the inline reply composer. */
  onCancel?: () => void;
  /** The panel's own bottom composer: separated by a rule, and sticky on mobile. */
  docked?: boolean;
}

function Composer({
  onPost,
  placeholder = "Write a comment…",
  submitLabel = "Post",
  onCancel,
  docked = false,
}: ComposerProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onPost(body.trim());
      setBody("");
    } catch (err) {
      setError(errorMessage(err, "Could not post your comment"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-sheet-dock={docked ? "" : undefined}
      className={
        docked
          ? "mt-5 border-t border-slate-100 pt-4 mobile:sticky mobile:bottom-0 mobile:-mx-5 mobile:-mb-5 mobile:bg-white/95 mobile:px-5 mobile:pb-5 mobile:backdrop-blur"
          : undefined
      }
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        rows={2}
        maxLength={MAX_COMMENT_LENGTH}
        autoFocus={!docked}
      />
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        {onCancel && (
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={submit} loading={submitting} disabled={!body.trim()}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
