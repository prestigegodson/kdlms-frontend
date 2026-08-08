import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { setInitialPassword } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { homePathForRole } from "@/routes/roleHome";
import { useAuthStore } from "@/stores/authStore";

type Status = { kind: "form" } | { kind: "submitting" } | { kind: "error"; message: string };

const GENERIC_ERROR = "Couldn't set your password. Please try again.";

/**
 * The forced first-sign-in screen for an account still holding a
 * system-generated temporary password (admin-created staff/guardian, or an
 * admin password-reset) - see RequireRole, the single chokepoint that
 * redirects here whenever `user.mustChangePassword` is true. No current
 * password field: the user just authenticated with the temporary one, and
 * the backend (ChangePasswordService#setInitialPassword) 422s this call for
 * anyone whose flag isn't set, so this can't become a general
 * current-password-free change path.
 * <p>
 * This route itself is not wrapped in RequireRole - that would loop, since
 * RequireRole is what sends a flagged user here in the first place - so it
 * guards its own access: anonymous -> /login, already-unflagged -> the
 * caller's portal home. Unlike PortalShell's pages, there is no nav here on
 * purpose; the one way out besides completing the form is signing out.
 */
export function SetInitialPasswordPage() {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const setSession = useAuthStore((state) => state.setSession);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "form" });

  if (!hydrated) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.mustChangePassword) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: "New password and confirmation don't match." });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const session = await setInitialPassword(newPassword);
      setSession(session);
      navigate(homePathForRole(session.user.role), { replace: true });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof ApiError ? error.message : GENERIC_ERROR,
      });
    }
  }

  function handleSignOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <AuthLayout
      title="Set your password"
      description="You signed in with a temporary password. Choose a new one to continue."
    >
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {status.kind === "error" && <Alert variant="error">{status.message}</Alert>}
        <FormField label="New password" htmlFor="newPassword">
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </FormField>
        <FormField label="Confirm new password" htmlFor="confirmPassword">
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </FormField>
        <Button type="submit" loading={status.kind === "submitting"} className="w-full">
          {status.kind === "submitting" ? "Setting password…" : "Set password"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={status.kind === "submitting"}
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </form>
    </AuthLayout>
  );
}
