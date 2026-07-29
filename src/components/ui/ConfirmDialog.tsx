import { type ReactNode, useState } from "react";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  /** "danger" (red confirm button) for irreversible/high-impact actions, "default" otherwise. */
  variant?: "danger" | "default";
  /**
   * When set, the confirm button stays disabled until the user types this
   * value exactly - used for the highest-risk actions (e.g. archiving a
   * school), where a single click is too easy to hit by accident.
   */
  confirmationText?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Shared confirmation modal for destructive/dangerous actions across the app. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  variant = "default",
  confirmationText,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresTyping = Boolean(confirmationText);
  const canConfirm = !requiresTyping || typed === confirmationText;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That action failed");
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="text-sm text-gray-700">{message}</div>

        {requiresTyping && (
          <FormField label={`Type "${confirmationText}" to confirm`} htmlFor="confirm-dialog-input">
            <Input
              id="confirm-dialog-input"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </FormField>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={submitting || !canConfirm}
          >
            {submitting ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
