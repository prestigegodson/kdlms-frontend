import { resetTakeHomeQuizAttempt, type StudentResultRowView } from "@/api/takeHomeQuizzes";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ResetAttemptDialogProps {
  quizId: string;
  studentId: string;
  studentName: string;
  onClose: () => void;
  onReset: (row: StudentResultRowView) => void;
}

/**
 * A plain `ConfirmDialog`, not a form - unlike {@link
 * "./AdjustScoreModal"}, resetting takes no reason: there's no durable
 * place for one to live (`audit_logs.details` stays numbers-only, and
 * there's no reset-specific trail table the way score adjustments have
 * one), so requiring text with nowhere to go would be theatre. The message
 * spells out exactly what gets cleared, per quiz-module.md's own wording.
 */
export function ResetAttemptDialog({ quizId, studentId, studentName, onClose, onReset }: ResetAttemptDialogProps) {
  async function handleConfirm() {
    const row = await resetTakeHomeQuizAttempt(quizId, studentId);
    onReset(row);
  }

  return (
    <ConfirmDialog
      title={`Reset ${studentName}'s attempt?`}
      message={
        <div className="space-y-2">
          <p>This clears everything they've done so far:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Their saved answers and score</li>
            <li>Their submission and start time</li>
          </ul>
          <p>
            Their existing link keeps working - the interstitial reappears, and the timer restarts from full
            on their next Start. Any past score adjustments are kept in the audit trail.
          </p>
        </div>
      }
      confirmLabel="Reset attempt"
      variant="danger"
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  );
}
