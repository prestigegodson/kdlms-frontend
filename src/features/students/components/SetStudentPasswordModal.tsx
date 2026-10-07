import { type FormEvent, useState } from "react";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { PasswordInput } from "@/components/ui/PasswordInput";

const MIN_LENGTH = 8;

interface SetStudentPasswordModalProps {
  open: boolean;
  /** `provision` creates the student's login; `reset` replaces an existing login's password. */
  mode: "provision" | "reset";
  studentName: string;
  onClose: () => void;
  /**
   * `password` is the admin-typed one, or `undefined` for "generate a temporary password
   * instead". Rejects with the API error to keep the modal open and show it.
   */
  onSubmit: (password: string | undefined) => Promise<void>;
}

/**
 * Sets a student's portal password. Typing a password the student can remember is the default:
 * the student keeps it as-is (no forced change at first sign-in) and it is never emailed. The
 * secondary action keeps the generated-temporary-password path, which emails the guardians and
 * forces a change.
 */
export function SetStudentPasswordModal({ open, mode, studentName, onClose, onSubmit }: SetStudentPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"typed" | "generated" | null>(null);

  function handleClose() {
    setPassword("");
    setConfirmPassword("");
    setError(null);
    onClose();
  }

  async function submit(value: string | undefined) {
    setError(null);
    setSubmitting(value === undefined ? "generated" : "typed");
    try {
      await onSubmit(value);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to set the password");
    } finally {
      setSubmitting(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`The password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }
    void submit(password);
  }

  const title = mode === "provision" ? "Provision portal login" : "Reset password";

  return (
    <Modal open={open} onClose={handleClose} title={title} size="md">
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-sm text-slate-700">
          Type a password {studentName} can remember. They'll use it as-is and won't be asked to change it.
          Share it with them directly - it isn't emailed.
        </p>
        <FormField label="Password" htmlFor="studentPassword" description={`At least ${MIN_LENGTH} characters.`}>
          <PasswordInput
            id="studentPassword"
            autoComplete="new-password"
            aria-describedby="studentPassword-description"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <FormField label="Confirm password" htmlFor="studentPasswordConfirm">
          <PasswordInput
            id="studentPasswordConfirm"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            loading={submitting === "generated"}
            disabled={submitting !== null}
            onClick={() => void submit(undefined)}
          >
            Generate a temporary password instead
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" disabled={submitting !== null} onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={submitting === "typed"} disabled={submitting !== null}>
              Set password
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
