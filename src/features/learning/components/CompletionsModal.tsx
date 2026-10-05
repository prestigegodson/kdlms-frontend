import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getLearningResourceCompletions, type ResourceCompletionsView } from "@/api/learning";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { CompletionsPanel } from "@/features/learning/components/CompletionsPanel";

interface CompletionsModalProps {
  resourceId: string;
  /** Overrides where the roster loads from (creators Phase C14: a class resource's learners). */
  load?: () => Promise<ResourceCompletionsView>;
  /** Passed through to `CompletionsPanel`. */
  personLabel?: string;
  onClose: () => void;
}

/**
 * Staff-facing completions roster (Phase 35H) - opened from `LearningResourcesPage`'s Actions
 * column, the `CommentsModal` shape exactly: a single fetch-on-mount, no moderation actions to
 * trigger a reload (this is a read-only view), so no refresh affordance is needed - reopening the
 * modal is the refresh.
 */
export function CompletionsModal({ resourceId, load, personLabel, onClose }: CompletionsModalProps) {
  const [completions, setCompletions] = useState<ResourceCompletionsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (load ? load() : getLearningResourceCompletions(resourceId))
      .then(setCompletions)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load completions"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is a fresh closure per render; fetch once per resource
  }, [resourceId]);

  return (
    <Modal open onClose={onClose} title={completions ? `Completions · ${completions.title}` : "Completions"} size="lg">
      {error && <Alert variant="error">{error}</Alert>}

      {!error && !completions && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}

      {completions && <CompletionsPanel completions={completions} personLabel={personLabel} />}
    </Modal>
  );
}
