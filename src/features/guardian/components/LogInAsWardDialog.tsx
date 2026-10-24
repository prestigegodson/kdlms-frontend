import { useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import type { MyWardView } from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAuthStore } from "@/stores/authStore";

interface LogInAsWardDialogProps {
  ward: MyWardView;
  onClose: () => void;
}

/**
 * Confirms and starts a guardian's "Log in as" session for one ward (see
 * authStore's `startWardLogin`) - the guardian-portal twin of
 * `schools/components/ImpersonateDialog`, minus the reason. On success the
 * whole app is signed in as the ward, so this navigates straight to the
 * student portal; "Back to my account" on the banner/user menu returns.
 */
export function LogInAsWardDialog({ ward, onClose }: LogInAsWardDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startWardLogin = useAuthStore((state) => state.startWardLogin);
  const navigate = useNavigate();

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await startWardLogin(ward.studentId);
      navigate("/student", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not log in as ${ward.fullName}`);
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Log in as ${ward.fullName}?`}>
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <p className="text-sm text-slate-700">
          You'll see the pupil portal exactly as <strong>{ward.fullName}</strong> does, and anything
          you do there is saved as theirs, for up to 4 hours. This is recorded in the school's
          audit trail.
        </p>

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
          <Button type="button" variant="primary" loading={submitting} onClick={submit} className="w-full sm:w-auto">
            Log in
          </Button>
        </div>
      </div>
    </Modal>
  );
}
