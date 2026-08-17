import { type FormEvent, useState } from "react";
import { changePassword } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { PasswordInput } from "@/components/ui/PasswordInput";

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

type Status =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

const GENERIC_ERROR = "Couldn't change your password. Please try again.";

/**
 * Reachable from every portal via the account menu in PortalShell's header
 * (see layouts/UserMenu.tsx) - any logged-in user, of any role, can change
 * their own password here. Unlike
 * ResetPasswordPage (the forgotten-password flow), this call goes out with
 * the caller's bearer token attached; see api/auth.ts#changePassword. A
 * wrong current password comes back as a 422 rather than a 401, precisely
 * so this failure surfaces as an inline error instead of tripping the
 * client's 401-means-expired-session handling and logging the user out.
 */
export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "form" });

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setStatus({ kind: "form" });
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: "New password and confirmation don't match." });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus({ kind: "done" });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof ApiError ? error.message : GENERIC_ERROR,
      });
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Change password">
      {status.kind === "done" ? (
        <div className="space-y-4">
          <Alert variant="success">Your password has been changed.</Alert>
          <div className="flex justify-end">
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {status.kind === "error" && <Alert variant="error">{status.message}</Alert>}
          <FormField label="Current password" htmlFor="currentPassword">
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              enterKeyHint="next"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </FormField>
          <FormField label="New password" htmlFor="newPassword">
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              enterKeyHint="next"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </FormField>
          <FormField label="Confirm new password" htmlFor="confirmPassword">
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              enterKeyHint="go"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={status.kind === "submitting"}>
              Cancel
            </Button>
            <Button type="submit" disabled={status.kind === "submitting"}>
              {status.kind === "submitting" ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
