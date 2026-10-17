import { useState } from "react";
import { ApiError } from "@/api/client";
import { type PublishOutcomeView, publishTakeHomeQuiz } from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { WriteBackOutcomePanel } from "@/features/takeHomeQuizzes/components/WriteBackOutcomePanel";

interface PublishQuizModalProps {
  open: boolean;
  onClose: () => void;
  quizId: string;
  rosterSize: number;
  /** Roster students with a portal login - publishing mints them no link and emails nobody about them. */
  portalRosterSize: number;
  /** The quiz goes only to chosen students - `rosterSize` counts just them. */
  selectedAudience?: boolean;
  closesAt: string;
  onPublished: () => void;
}

/**
 * Publishes a quiz - mints one token per roster student and emails their
 * guardians (`quiz-module.md`'s Phase 20C) - except a student with a
 * portal login, who takes it signed in and gets neither (Phase 35I), so the
 * preflight wording depends on how much of the roster that covers. Two-phase render like {@code
 * CopyLessonNotesModal}: a preflight summary, then the {@link
 * PublishOutcomeView} outcome in place of the form. The close time renders
 * via the browser's own `toLocaleString()` - the server sends an ISO
 * instant and never needs to know the caller's zone.
 */
export function PublishQuizModal({
  open,
  onClose,
  quizId,
  rosterSize,
  portalRosterSize,
  selectedAudience = false,
  closesAt,
  onPublished,
}: PublishQuizModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PublishOutcomeView | null>(null);

  async function handlePublish() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await publishTakeHomeQuiz(quizId);
      setOutcome(result);
      onPublished();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to publish this quiz");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setOutcome(null);
    setError(null);
    onClose();
  }

  const closesAtDisplay = new Date(closesAt).toLocaleString();
  const linkCount = Math.max(0, rosterSize - portalRosterSize);
  const roster = selectedAudience ? "you selected" : "on this class's roster";
  const closesSentence = (
    <>
      The quiz closes <span className="font-medium">{closesAtDisplay}</span>.
    </>
  );

  return (
    <Modal open={open} onClose={handleClose} title="Publish this quiz" size="md">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {outcome ? (
          <div className="space-y-3">
            {outcome.tokensMinted === 0 && portalRosterSize > 0 ? (
              <p className="text-sm text-slate-700">Published. Pupils will find it in their portal.</p>
            ) : (
              <p className="text-sm text-slate-700">
                <span className="font-medium">{outcome.tokensMinted}</span> link
                {outcome.tokensMinted === 1 ? "" : "s"} minted, <span className="font-medium">
                  {outcome.guardiansNotified}
                </span>{" "}
                guardian{outcome.guardiansNotified === 1 ? "" : "s"} notified.
              </p>
            )}
            <WriteBackOutcomePanel rows={outcome.perStudent} />
            <div className="flex justify-end pt-2">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            {portalRosterSize === 0 ? (
              <p className="text-sm text-slate-700">
                This will mint a link for each of the <span className="font-medium">{rosterSize}</span> pupil
                {rosterSize === 1 ? "" : "s"} {roster} and email their guardians. {closesSentence}
              </p>
            ) : linkCount === 0 ? (
              <p className="text-sm text-slate-700">
                {rosterSize === 1 ? "The" : "All"} <span className="font-medium">{rosterSize}</span> pupil
                {rosterSize === 1 ? "" : "s"} {roster} {rosterSize === 1 ? "has a" : "have"} portal
                login{rosterSize === 1 ? "" : "s"}, so {rosterSize === 1 ? "they'll" : "they'll each"} find this quiz
                in their portal. No links will be created and no guardian emails sent. {closesSentence}
              </p>
            ) : (
              <p className="text-sm text-slate-700">
                {selectedAudience && (
                  <>
                    Only the <span className="font-medium">{rosterSize}</span> pupil{rosterSize === 1 ? "" : "s"} you
                    selected will get this quiz.{" "}
                  </>
                )}
                <span className="font-medium">{portalRosterSize}</span> pupil{portalRosterSize === 1 ? "" : "s"} with
                a portal login will find this quiz in their portal. A link will be created for each of the other{" "}
                <span className="font-medium">{linkCount}</span> and emailed to their guardians. {closesSentence}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" variant="accent" loading={submitting} onClick={handlePublish}>
                Publish
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
