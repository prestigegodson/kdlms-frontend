import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ApiError } from "@/api/client";
import { acceptInvite, type InviteDetails, previewInvite } from "@/api/invites";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Spinner } from "@/components/ui/Spinner";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { GoogleSignInButton, OrDivider } from "@/features/auth/GoogleSignInButton";
import { homePathForRole } from "@/routes/roleHome";
import { useAuthStore } from "@/stores/authStore";

type Status =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "ready"; invite: InviteDetails }
  | { kind: "signInRequired"; invite: InviteDetails };

const INVALID_MESSAGE = "This invitation link is invalid or has expired. Ask whoever invited you to send a new one.";

/**
 * Accepts an education creator's learner or guardian invite (creators.md Phase C5). The token comes
 * from the `/invite/:token` link in the invite email. A new invitee sets a password (and, for a
 * guardian, their name) or continues with Google and lands signed in; someone who already has a
 * KDLMS password just confirms and then signs in as usual.
 */
export function InviteAcceptPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const [status, setStatus] = useState<Status>(
    token ? { kind: "loading" } : { kind: "invalid", message: INVALID_MESSAGE },
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    previewInvite(token)
      .then((invite) => {
        if (!cancelled) {
          setStatus({ kind: "ready", invite });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus({ kind: "invalid", message: err instanceof ApiError ? err.message : INVALID_MESSAGE });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>, invite: InviteDetails) {
    event.preventDefault();
    setError(null);
    if (invite.passwordRequired && password !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await acceptInvite({
        token,
        password: invite.passwordRequired ? password : null,
        firstName: invite.nameRequired ? firstName : null,
        lastName: invite.nameRequired ? lastName : null,
      });
      if (result.session) {
        setSession(result.session);
        navigate(homePathForRole(result.session.user.role), { replace: true });
      } else {
        setStatus({ kind: "signInRequired", invite });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't accept this invitation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleCredential(idToken: string) {
    setError(null);
    try {
      const user = await loginWithGoogle(idToken, "ACCEPT_INVITE", null, token);
      navigate(homePathForRole(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't accept this invitation with Google.");
    }
  }

  if (status.kind === "loading") {
    return (
      <AuthLayout title="Accept your invitation">
        <div className="mt-6 flex justify-center">
          <Spinner />
        </div>
      </AuthLayout>
    );
  }

  if (status.kind === "invalid") {
    return (
      <AuthLayout title="Accept your invitation">
        <div className="mt-6 space-y-4">
          <Alert variant="error">{status.message}</Alert>
          <Link to="/login" className="block text-center text-sm font-medium text-brand-500 hover:text-brand-600">
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (status.kind === "signInRequired") {
    return (
      <AuthLayout title="Invitation accepted">
        <div className="mt-6 space-y-4">
          <Alert variant="success">
            You're all set. Sign in with your existing KDLMS password to see{" "}
            {status.invite.role === "GUARDIAN" ? `${status.invite.learnerName}'s` : "your"} classes.
          </Alert>
          <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
            Go to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const { invite } = status;
  const from = invite.creatorName ?? "Your tutor";
  const description =
    invite.role === "GUARDIAN"
      ? `${from} has added ${invite.learnerName} to their online classes and invited you to follow along as their guardian.`
      : `${from} has invited you to their online classes.`;

  return (
    <AuthLayout title="Accept your invitation" description={description}>
      {invite.passwordRequired && (
        <div className="mt-6">
          <GoogleSignInButton mode="signup" onCredential={handleGoogleCredential} after={<OrDivider />} />
        </div>
      )}
      <form className="mt-6 space-y-4" onSubmit={(event) => handleSubmit(event, invite)}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Email" htmlFor="invite-email">
          <Input id="invite-email" type="email" value={invite.email} readOnly disabled />
        </FormField>
        {invite.nameRequired && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="First name" htmlFor="invite-first-name">
              <Input
                id="invite-first-name"
                autoComplete="given-name"
                required
                maxLength={100}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </FormField>
            <FormField label="Last name" htmlFor="invite-last-name">
              <Input
                id="invite-last-name"
                autoComplete="family-name"
                required
                maxLength={100}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </FormField>
          </div>
        )}
        {invite.passwordRequired ? (
          <>
            <FormField label="Choose a password" htmlFor="invite-password" description="At least 8 characters.">
              <PasswordInput
                id="invite-password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>
            <FormField label="Confirm password" htmlFor="invite-confirm-password">
              <PasswordInput
                id="invite-confirm-password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </FormField>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            You already have a KDLMS account. Accept the invitation, then sign in with your existing password.
          </p>
        )}
        <Button type="submit" loading={submitting} className="w-full">
          {invite.passwordRequired ? "Accept and sign in" : "Accept invitation"}
        </Button>
      </form>
    </AuthLayout>
  );
}
