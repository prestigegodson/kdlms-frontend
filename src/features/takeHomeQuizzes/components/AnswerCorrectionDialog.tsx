import type { AnswerCorrectionView } from "@/api/takeHomeQuizzes";
import { useParticipantNoun } from "@/components/ParticipantNoun";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { count } from "@/features/takeHomeQuizzes/answerCorrection";

interface AnswerCorrectionDialogProps {
  /** The server's dry run of the correction - what saving it would change. */
  preview: AnswerCorrectionView<unknown>;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * Confirms a correction on a quiz that already has submissions, showing what the server's preview
 * says it will do - how many submitted attempts are re-scored and change, which manual adjustments
 * are kept, and whether the gradebook is rewritten - before anything is saved. A wording-only fix
 * (prompts, option labels, passage text) re-scores nothing, and says so.
 */
export function AnswerCorrectionDialog({ preview, onConfirm, onClose }: AnswerCorrectionDialogProps) {
  const { singular, plural } = useParticipantNoun();
  const totalChanged = preview.previousTotalPoints !== preview.newTotalPoints;
  if (preview.rescoredQuestions === 0) {
    return (
      <ConfirmDialog
        title="Save the corrected wording?"
        confirmLabel="Save wording"
        onConfirm={onConfirm}
        onClose={onClose}
        message={
          <div className="space-y-3">
            <ul className="list-disc space-y-1 pl-5">
              {preview.changedQuestions > 0 && <li>{count(preview.changedQuestions, "question")} reworded.</li>}
              {preview.passagesChanged && <li>Passage text updated.</li>}
              <li>No answers or points changed, so no scores change.</li>
            </ul>
            <p className="text-xs text-slate-500">
              {capitalize(plural)} who already submitted see the new wording when they review the quiz.
            </p>
          </div>
        }
      />
    );
  }
  return (
    <ConfirmDialog
      title="Correct the answer key?"
      confirmLabel="Correct and re-score"
      onConfirm={onConfirm}
      onClose={onClose}
      message={
        <div className="space-y-3">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {count(preview.changedQuestions, "question")} corrected; {count(preview.submittedAttempts, "submitted attempt")}{" "}
              re-scored.
            </li>
            <li>
              {preview.scoresChanged === 0
                ? "No score changes."
                : `The score changes for ${count(preview.scoresChanged, singular, plural)}.`}
            </li>
            {totalChanged && (
              <li>
                The quiz total goes from {preview.previousTotalPoints} to {preview.newTotalPoints} points.
              </li>
            )}
            {preview.overridesKept > 0 && (
              <li>
                {count(preview.overridesKept, "manually adjusted score")} will be kept as{" "}
                {preview.overridesKept === 1 ? "it is" : "they are"}.
                {preview.overridesAboveNewTotal > 0 &&
                  ` ${preview.overridesAboveNewTotal} of them ${preview.overridesAboveNewTotal === 1 ? "is" : "are"} now above the new total.`}
              </li>
            )}
            {preview.gradebookResync && <li>The midterm quiz scores in the gradebook will be updated.</li>}
          </ul>
          {preview.midtermMaxExceeded && (
            <Alert variant="warning">
              The new total is above the level&apos;s midterm maximum of {preview.midtermMax}.
              {preview.gradebookResync
                ? " Lower the points, or unpublish the results first."
                : " Results can't be published until the total is lowered."}
            </Alert>
          )}
          <p className="text-xs text-slate-500">
            {capitalize(plural)} still taking the quiz are scored against the corrected key when they submit.
          </p>
        </div>
      }
    />
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
