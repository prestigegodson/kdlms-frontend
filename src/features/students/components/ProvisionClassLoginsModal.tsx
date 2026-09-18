import { useState } from "react";
import { ApiError } from "@/api/client";
import { type ProvisioningResult, provisionClassCredentials } from "@/api/students";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CheckCircle2, XCircle } from "lucide-react";

interface ProvisionClassLoginsModalProps {
  open: boolean;
  onClose: () => void;
  classId: string;
  onProvisioned: () => void;
}

/**
 * Bulk-provisions portal logins for a class (Phase 35B) - the {@code PublishQuizModal}
 * two-phase pattern: a preflight summary, then the {@link ProvisioningResult} outcome in place
 * of the confirm form. Unlike a quiz publish, a student who already has a login is silently
 * excluded (never a failed row) - re-running this action is always a safe no-op.
 */
export function ProvisionClassLoginsModal({
  open,
  onClose,
  classId,
  onProvisioned,
}: ProvisionClassLoginsModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisioningResult | null>(null);

  async function handleProvision() {
    setSubmitting(true);
    setError(null);
    try {
      const outcome = await provisionClassCredentials(classId);
      setResult(outcome);
      onProvisioned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to provision logins for this class");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Provision portal logins" size="md">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              <span className="font-medium">{result.provisioned}</span> login
              {result.provisioned === 1 ? "" : "s"} provisioned,{" "}
              <span className="font-medium">{result.guardiansNotified}</span> guardian
              {result.guardiansNotified === 1 ? "" : "s"} notified.
            </p>
            {result.rows.length > 0 && (
              <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain">
                {result.rows.map((row) => (
                  <div
                    key={row.studentId}
                    className={`flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${
                      row.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    {row.success ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                    )}
                    <span>
                      <span className="font-medium">{row.studentName}</span>
                      {row.loginId && (
                        <>
                          {" "}
                          &mdash; <code className="rounded bg-white px-1 py-0.5">{row.loginId}</code>
                        </>
                      )}
                      {row.message && <span className="text-slate-600"> &mdash; {row.message}</span>}
                      {row.temporaryPassword && (
                        <span className="block text-xs text-slate-600">
                          Temporary password:{" "}
                          <code className="rounded bg-white px-1 py-0.5">{row.temporaryPassword}</code> - shown
                          only now, share it with the student directly.
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-700">
              This provisions a portal login for every active student on this class's current-term
              roster who doesn't already have one, and emails each one's guardians their sign-in
              details. A student with no active guardian has their temporary password shown here
              instead - share it with them directly.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" variant="accent" loading={submitting} onClick={handleProvision}>
                Provision
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
