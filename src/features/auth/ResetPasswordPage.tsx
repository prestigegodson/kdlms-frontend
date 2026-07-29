import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { confirmPasswordReset } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

type Status =
  { kind: "form" } | { kind: "submitting" } | { kind: "done" } | { kind: "error"; message: string };

/** Confirms a password reset. Pre-fills the token from ?token= if the link included one (e.g. via the dev-only exposed-token flow). */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "form" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "submitting" });
    try {
      await confirmPasswordReset(token, newPassword);
      setStatus({ kind: "done" });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof ApiError ? error.message : "That reset link is invalid or has expired.",
      });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900">Choose a new password</h1>

        {status.kind === "done" ? (
          <div className="mt-6 space-y-4">
            <Alert variant="success">Your password has been reset. You can now sign in.</Alert>
            <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
              Go to sign in
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {status.kind === "error" && <Alert variant="error">{status.message}</Alert>}
            <FormField label="Reset token" htmlFor="token">
              <Input
                id="token"
                required
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </FormField>
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
            <Button type="submit" disabled={status.kind === "submitting"} className="w-full">
              {status.kind === "submitting" ? "Resetting…" : "Reset password"}
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
