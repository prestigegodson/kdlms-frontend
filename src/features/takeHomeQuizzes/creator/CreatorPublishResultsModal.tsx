import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  type ClassQuizPreflightView,
  getClassQuizResultsPreflight,
  publishClassQuizResults,
} from "@/api/classTakeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";

interface CreatorPublishResultsModalProps {
  classId: string;
  quizId: string;
  onClose: () => void;
  onPublished: () => void;
}

/**
 * Publishing a class quiz's results (creators Phase C13) - the school `PublishResultsModal`'s
 * preflight and non-submitter confirmation, without its gradebook write-back: a creator tenant has
 * none, so publishing only releases each learner's score and review (and a minor's guardian's view).
 */
export function CreatorPublishResultsModal({ classId, quizId, onClose, onPublished }: CreatorPublishResultsModalProps) {
  const [preflight, setPreflight] = useState<ClassQuizPreflightView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getClassQuizResultsPreflight(classId, quizId)
      .then(setPreflight)
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load preflight"));
  }, [classId, quizId]);

  async function handlePublish() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await publishClassQuizResults(classId, quizId, confirmed);
      onPublished();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to publish results");
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

        {!preflight ? (
          !loadError && (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <Spinner /> Loading…
            </div>
          )
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
              {preflight.submittedCount} of {preflight.rosterSize} learner{preflight.rosterSize === 1 ? "" : "s"}{" "}
              submitted. Publishing shows each learner their score and the correct answers.
            </p>

            {hasNonSubmitters && (
              <div className="space-y-2">
                <p className="text-sm text-slate-700">
                  {preflight.nonSubmitters.length} learner{preflight.nonSubmitters.length === 1 ? " hasn't" : "s haven't"}{" "}
                  submitted:
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto overscroll-contain rounded-control border border-slate-200 p-2">
                  {preflight.nonSubmitters.map((learner) => (
                    <div key={learner.learnerId} className="px-1 py-1 text-sm text-slate-700">
                      {learner.fullName}
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  Publish without their submissions.
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" variant="accent" loading={submitting} disabled={!canConfirm} onClick={handlePublish}>
                Publish results
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
