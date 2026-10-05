import { useState } from "react";
import { resendEmailVerification } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";

type ResendState = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

/**
 * The creator portal's "verify your email" prompt - shown while the signed-in creator's email is
 * unverified (an undefined flag counts as verified), since every write is refused server-side
 * until they follow the link (403 email-unverified). Offers a resend; the backend enforces a
 * short cooldown between emails.
 */
export function VerifyEmailBanner() {
  const user = useAuthStore((state) => state.user);
  const [resend, setResend] = useState<ResendState>({ kind: "idle" });

  if (!user || user.emailVerified !== false) {
    return null;
  }

  async function handleResend() {
    setResend({ kind: "sending" });
    try {
      await resendEmailVerification();
      setResend({ kind: "sent" });
    } catch (err) {
      setResend({
        kind: "error",
        message: err instanceof ApiError ? err.message : "We couldn't send the email. Please try again.",
      });
    }
  }

  return (
    <Alert variant="warning" title="Verify your email address" className="mb-6">
      <p>
        We sent a verification link to <strong>{user.email}</strong>. You can look around, but you can't make
        changes until you verify.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={resend.kind === "sending"}
          disabled={resend.kind === "sent"}
          onClick={handleResend}
        >
          Resend email
        </Button>
        {resend.kind === "sent" && <span className="text-sm">Sent - check your inbox.</span>}
        {resend.kind === "error" && <span className="text-sm">{resend.message}</span>}
      </div>
    </Alert>
  );
}
