import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  getPublishResultsPreflight,
  type PreflightView,
  publishTakeHomeQuizResults,
  type QuizType,
  type WriteBackOutcomeView,
} from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { WriteBackOutcomePanel } from "@/features/takeHomeQuizzes/components/WriteBackOutcomePanel";

interface PublishResultsModalProps {
  quizId: string;
  quizType: QuizType;
  onClose: () => void;
  onPublished: () => void;
}

/**
 * The mandatory confirmation screen for `PUBLISHED -> RESULTS_PUBLISHED` (Phase 20F) - see
 * quiz-module.md's "Phase 20F — Results publication and midterm write-back". Fetches its own
 * {@link PreflightView} on mount (unlike {@link "./PublishQuizModal"}, which takes its summary
 * data as props) since the non-submitter list and blockers are this modal's entire reason to
 * exist. Two-phase render like `PublishQuizModal`: the confirmation form, then the
 * {@link WriteBackOutcomeView} outcome in place of the form. Every non-submitter is named
 * explicitly, never just counted, and the confirmation checkbox is the only thing standing
 * between the teacher and a `danger`-variant Publish button - the server enforces the same gate
 * independently (422 if non-submitters exist and the flag is false), so this is a UX
 * convenience, not the security boundary.
 */
export function PublishResultsModal({ quizId, quizType, onClose, onPublished }: PublishResultsModalProps) {
  const [preflight, setPreflight] = useState<PreflightView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<WriteBackOutcomeView | null>(null);

  useEffect(() => {
    getPublishResultsPreflight(quizId)
      .then(setPreflight)
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load preflight"));
  }, [quizId]);

  async function handlePublish() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await publishTakeHomeQuizResults(quizId, confirmed);
      setOutcome(result);
      onPublished();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to publish results");
    } finally {
      setSubmitting(false);
    }
  }

  const hasNonSubmitters = (preflight?.nonSubmitters.length ?? 0) > 0;
  const canConfirm = Boolean(preflight?.canPublish) && (!hasNonSubmitters || confirmed);

  return (
    <Modal open onClose={onClose} title="Publish results" size="md">
      <div className="space-y-4">
        {loadError && <Alert variant="error">{loadError}</Alert>}
        {submitError && <Alert variant="error">{submitError}</Alert>}

        {outcome ? (
          <div className="space-y-3">
            {quizType === "NORMAL" ? (
              <p className="text-sm text-slate-700">
                Results published. Nothing is written to the gradebook for a normal quiz.
              </p>
            ) : (
              <p className="text-sm text-slate-700">
                <span className="font-medium">{outcome.scoresWritten}</span> score
                {outcome.scoresWritten === 1 ? "" : "s"} written.
              </p>
            )}
            <WriteBackOutcomePanel rows={outcome.perStudent} />
            <div className="flex justify-end pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : !preflight ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        ) : (
          <>
            {preflight.blockers.length > 0 && (
              <Alert variant="warning" title="Not ready to publish">
                <ul className="list-inside list-disc space-y-1">
                  {preflight.blockers.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <p className="text-sm text-slate-700">
              {preflight.submittedCount} of {preflight.rosterSize} student
              {preflight.rosterSize === 1 ? "" : "s"} submitted.
              {preflight.willWriteBack && preflight.midtermMax !== null && (
                <> Scores will be written to the midterm quiz score, out of {preflight.midtermMax}.</>
              )}
            </p>

            {hasNonSubmitters && (
              <div className="space-y-2">
                <p className="text-sm text-slate-700">
                  {quizType === "MIDTERM"
                    ? `These ${preflight.nonSubmitters.length} student${
                        preflight.nonSubmitters.length === 1 ? "" : "s"
                      } will be scored 0, and that 0 will be written to their midterm quiz score:`
                    : `These ${preflight.nonSubmitters.length} student${
                        preflight.nonSubmitters.length === 1 ? "" : "s"
                      } will be recorded as non-submitters. Nothing is written to the gradebook:`}
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto overscroll-contain rounded-control border border-slate-200 p-2">
                  {preflight.nonSubmitters.map((student) => (
                    <div key={student.studentId} className="px-1 py-1 text-sm text-slate-700">
                      {student.fullName}
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  {quizType === "MIDTERM"
                    ? "I understand these students will be scored 0."
                    : "I understand these students will be recorded as non-submitters."}
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={submitting}
                disabled={!canConfirm}
                onClick={handlePublish}
              >
                Publish results
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
