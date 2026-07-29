import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { requestPasswordReset } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

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
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900">Reset your password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email and we'll send you a reset link.
        </p>

        {status.kind === "sent" ? (
          <div className="mt-6 space-y-4">
            <Alert variant="success">
              If an account exists for that email, a reset link has been sent.
            </Alert>
            {status.devToken && <DevTokenReveal token={status.devToken} />}
            <Link
              to="/login"
              className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700"
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
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
            <Button type="submit" disabled={status.kind === "submitting"} className="w-full">
              {status.kind === "submitting" ? "Sending…" : "Send reset link"}
            </Button>
            <Link
              to="/login"
              className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </Card>
    </div>
  );
}

/** Local escape hatch for testing the reset flow when no real email provider is configured - see kdlms.email.provider. */
function DevTokenReveal({ token }: { token: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
        onClick={() => setOpen(true)}
      >
        Show dev token (no email delivery configured)
      </button>
    );
  }

  return (
    <Alert variant="info">
      Dev token: <code className="break-all">{token}</code>
    </Alert>
  );
}
