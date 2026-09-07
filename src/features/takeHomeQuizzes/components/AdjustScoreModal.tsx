import { useState } from "react";
import { adjustTakeHomeQuizScore, type StudentResultRowView } from "@/api/takeHomeQuizzes";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";

interface AdjustScoreModalProps {
  quizId: string;
  studentId: string;
  studentName: string;
  currentScore: number | null;
  totalPoints: number;
  onClose: () => void;
  onAdjusted: (row: StudentResultRowView) => void;
}

/**
 * A teacher's manual override of one student's auto-computed score, with a
 * mandatory reason (Phase 20E) - the `ReviewDecisionModal` shape (a
 * `Textarea` plus a `Button loading={submitting}`), except the reason here
 * is required unconditionally rather than only for a rejection, matching
 * quiz-module.md's "score adjustment with a mandatory reason". Submit stays
 * disabled while the reason is blank or the score is outside
 * `[0, totalPoints]` - "rejected 422 client- and server-side" per that same
 * plan's acceptance criteria.
 */
export function AdjustScoreModal({
  quizId,
  studentId,
  studentName,
  currentScore,
  totalPoints,
  onClose,
  onAdjusted,
}: AdjustScoreModalProps) {
  const [score, setScore] = useState(currentScore !== null ? String(currentScore) : "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedScore = score.trim() === "" ? null : Number(score);
  const scoreInRange = parsedScore !== null && !Number.isNaN(parsedScore) && parsedScore >= 0
    && parsedScore <= totalPoints;
  const canSubmit = scoreInRange && reason.trim() !== "";

  async function submit() {
    if (!scoreInRange || parsedScore === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const row = await adjustTakeHomeQuizScore(quizId, studentId, {
        newScore: parsedScore,
        reason: reason.trim(),
      });
      onAdjusted(row);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not adjust this score");
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Adjust ${studentName}'s score`}>
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <FormField label={`Score (0 – ${totalPoints})`} htmlFor="adjust-score-value">
          <Input
            id="adjust-score-value"
            type="number"
            min={0}
            max={totalPoints}
            step="1"
            value={score}
            onChange={(event) => setScore(event.target.value)}
            aria-invalid={score.trim() !== "" && !scoreInRange}
          />
        </FormField>

        <FormField label="Reason (required)" htmlFor="adjust-score-reason">
          <Textarea
            id="adjust-score-reason"
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this score being changed?"
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
            variant="primary"
            loading={submitting}
            disabled={!canSubmit}
            onClick={submit}
            className="w-full sm:w-auto"
          >
            Save adjustment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
