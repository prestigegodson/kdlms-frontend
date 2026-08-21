import { useState } from "react";
import { ApiError } from "@/api/client";
import type { LessonNoteView, ReviewDecision } from "@/api/lessonNotes";
import { reviewLessonNote } from "@/api/lessonNotes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";

interface ReviewDecisionModalProps {
  noteId: string;
  decision: ReviewDecision;
  onClose: () => void;
  onReviewed: (view: LessonNoteView) => void;
}

/**
 * Serves both APPROVE and REJECT - the `ThreadCard`/`ReplyComposer` shape: a `Textarea`, a
 * `Button loading={submitting}`, and local `ApiError`-derived error state. A comment is required
 * for REJECT (the teacher needs to know what to fix) and optional for APPROVE.
 */
export function ReviewDecisionModal({ noteId, decision, onClose, onReviewed }: ReviewDecisionModalProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReject = decision === "REJECT";
  const canSubmit = !isReject || comment.trim() !== "";

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const view = await reviewLessonNote(noteId, decision, comment.trim() === "" ? null : comment.trim());
      onReviewed(view);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record this review");
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isReject ? "Reject lesson note" : "Approve lesson note"}>
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <FormField
          label={isReject ? "Comment (required)" : "Comment (optional)"}
          htmlFor="review-decision-comment"
        >
          <Textarea
            id="review-decision-comment"
            rows={4}
            maxLength={2000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={isReject ? "What needs to change before this is approved?" : "Any notes for the teacher…"}
          />
        </FormField>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isReject ? "danger" : "primary"}
            loading={submitting}
            disabled={!canSubmit}
            onClick={submit}
            className="w-full sm:w-auto"
          >
            {isReject ? "Reject" : "Approve"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
