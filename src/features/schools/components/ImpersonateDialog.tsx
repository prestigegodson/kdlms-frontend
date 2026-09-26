import { useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import type { SchoolUserView } from "@/api/users";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useAuthStore } from "@/stores/authStore";

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

interface ImpersonateDialogProps {
  schoolId: string;
  admin: SchoolUserView;
  onClose: () => void;
}

/**
 * Confirms and starts a support impersonation session (see authStore's
 * `startImpersonation`) - the reason textarea mirrors
 * `lessonNotes/components/ReviewDecisionModal`'s shape. On success the whole
 * app is now signed in as `admin`, so this navigates straight to the school
 * portal rather than closing back into the system-admin console.
 */
export function ImpersonateDialog({ schoolId, admin, onClose }: ImpersonateDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startImpersonation = useAuthStore((state) => state.startImpersonation);
  const navigate = useNavigate();

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= MIN_REASON_LENGTH && trimmed.length <= MAX_REASON_LENGTH;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await startImpersonation(schoolId, admin.id, trimmed);
      navigate("/school", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start impersonation");
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Impersonate this admin?">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <p className="text-sm text-slate-700">
          You'll be signed in to the school portal as{" "}
          <strong>
            {admin.firstName} {admin.lastName}
          </strong>{" "}
          ({admin.email}) with full access, for up to 60 minutes. This is recorded in the audit
          trail.
        </p>

        <FormField label="Reason (required, 10-500 characters)" htmlFor="impersonate-reason">
          <Textarea
            id="impersonate-reason"
            rows={3}
            maxLength={MAX_REASON_LENGTH}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Support ticket #1234 - investigating a stuck report export"
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
            Start impersonating
          </Button>
        </div>
      </div>
    </Modal>
  );
}
