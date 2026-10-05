import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { confirmEmailVerification } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { homePathForRole } from "@/routes/roleHome";
import { useAuthStore } from "@/stores/authStore";

type Status = { kind: "verifying" } | { kind: "done" } | { kind: "error"; message: string };

/**
 * Lands from the link in the verification email ({appBaseUrl}/verify-email?token=...). Confirms
 * the token as soon as the page opens, then - if this browser is signed in - refreshes the
 * session so the token's email-unverified gate drops and the portal's banner clears.
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const user = useAuthStore((state) => state.user);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const [status, setStatus] = useState<Status>(
    token ? { kind: "verifying" } : { kind: "error", message: "This verification link is incomplete." },
  );
  // Strict mode mounts effects twice in development; a token is single use, so confirm it once.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) {
      return;
    }
    attempted.current = true;
    confirmEmailVerification(token)
      .then(async () => {
        if (useAuthStore.getState().refreshToken) {
          await refreshSession();
        }
        setStatus({ kind: "done" });
      })
      .catch((error: unknown) =>
        setStatus({
          kind: "error",
          message: error instanceof ApiError ? error.message : "This verification link is invalid or has expired.",
        }),
      );
  }, [token, refreshSession]);

  const continuePath = user ? homePathForRole(user.role) : "/login";

  return (
    <AuthLayout title="Verify your email">
      <div className="mt-6 space-y-4">
        {status.kind === "verifying" && (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Spinner /> Verifying your email…
          </div>
        )}
        {status.kind === "done" && <Alert variant="success">Your email address is verified. You're all set.</Alert>}
        {status.kind === "error" && (
          <Alert variant="error">
            {status.message} Sign in and use "Resend email" on the banner to get a fresh link.
          </Alert>
        )}
        {status.kind !== "verifying" && (
          <Button className="w-full" onClick={() => navigate(continuePath, { replace: true })}>
            {user ? "Continue" : "Go to sign in"}
          </Button>
        )}
        {!user && status.kind === "error" && (
          <Link to="/creators/signup" className="block text-center text-sm font-medium text-brand-500 hover:text-brand-600">
            Create a creator account
          </Link>
        )}
      </div>
    </AuthLayout>
  );
}
