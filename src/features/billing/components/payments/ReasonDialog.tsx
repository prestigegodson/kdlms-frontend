import { useId, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";

interface ReasonDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  /** Called with the trimmed reason; a rejection is shown in the dialog and the reason kept. */
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

/** A confirm-with-a-required-reason dialog (void a confirmed payment, D11) - `ConfirmDialog` has no input. */
export function ReasonDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (reason.trim() === "") return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(getErrorMessage(err, "That action failed"));
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={() => !submitting && onClose()} title={title} size="md">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-sm text-slate-700">{message}</p>
        <FormField label="Reason" htmlFor={`${id}-reason`}>
          <Textarea
            id={`${id}-reason`}
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={confirm}
            loading={submitting}
            disabled={reason.trim() === ""}
            className="w-full sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
