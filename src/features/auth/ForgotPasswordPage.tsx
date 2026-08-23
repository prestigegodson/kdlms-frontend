import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { requestPasswordReset } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { AuthLayout } from "@/features/auth/AuthLayout";

type Status =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "sent"; devToken?: string }
  | { kind: "error"; message: string };

/**
 * Always shows the same success message regardless of whether the email
 * matches an account - the backend deliberately behaves identically either
 * way, so this can't be used to enumerate registered users (see
 * PasswordResetUseCase's Javadoc). A raw reset token only ever comes back
 * in the response when the backend has kdlms.password-reset.expose-token
 * enabled - a local/dev escape hatch for when kdlms.email.provider isn't
 * set to a real delivery provider - in which case it's tucked behind a
 * collapsed reveal so the flow can still be exercised end-to-end.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "form" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "submitting" });
    try {
      const result = await requestPasswordReset(email);
      setStatus({ kind: "sent", devToken: result.token });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      });
    }
  }

  return (
    <AuthLayout title="Reset your password" description="Enter your email and we'll send you a reset link.">
      {status.kind === "sent" ? (
        <div className="mt-6 space-y-4">
          <Alert variant="success">
            If an account exists for that email, a reset link has been sent.
          </Alert>
          {status.devToken && <DevTokenReveal token={status.devToken} />}
          <Link
            to="/login"
            className="block text-center text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {status.kind === "error" && <Alert variant="error">{status.message}</Alert>}
          <FormField label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              enterKeyHint="go"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <Button type="submit" loading={status.kind === "submitting"} className="w-full">
            {status.kind === "submitting" ? "Sending…" : "Send reset link"}
          </Button>
          <Link
            to="/login"
            className="block text-center text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}

/** Local escape hatch for testing the reset flow when no real email provider is configured - see kdlms.email.provider. */
function DevTokenReveal({ token }: { token: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="text-sm font-medium text-brand-500 hover:text-brand-600"
        onClick={() => setOpen(true)}
      >
        Show dev token (no email delivery configured)
      </button>
    );
  }

  return (
    <Alert variant="info">
      <Link
        to={`/reset-password?token=${encodeURIComponent(token)}`}
        className="font-medium text-brand-500 underline hover:text-brand-600"
      >
        Continue to reset password
      </Link>
    </Alert>
  );
}
