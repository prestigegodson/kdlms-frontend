import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import { confirmUnsubscribe, getUnsubscribeStatus } from "@/api/newsletters";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { AuthLayout } from "@/features/auth/AuthLayout";

type State =
  | { kind: "loading" }
  | { kind: "ready"; maskedEmail: string }
  | { kind: "done"; maskedEmail: string }
  | { kind: "error"; message: string };

/**
 * Lands from the unsubscribe link in every newsletter ({appBaseUrl}/unsubscribe?token=...).
 * Public - no sign-in. Opening the link changes nothing (mail scanners follow links); the
 * reader confirms with a button. Only newsletters stop - account emails still arrive.
 */
export function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<State>(
    token
      ? { kind: "loading" }
      : { kind: "error", message: "This unsubscribe link is incomplete." },
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getUnsubscribeStatus(token)
      .then((status) => {
        if (cancelled) return;
        setState(
          status.unsubscribed
            ? { kind: "done", maskedEmail: status.maskedEmail }
            : { kind: "ready", maskedEmail: status.maskedEmail },
        );
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({
            kind: "error",
            message: getErrorMessage(caught, "This unsubscribe link is invalid."),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function unsubscribe() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const status = await confirmUnsubscribe(token);
      setState({ kind: "done", maskedEmail: status.maskedEmail });
    } catch (caught) {
      setSubmitError(getErrorMessage(caught, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Email preferences">
      <div className="mt-6 space-y-4 text-sm text-slate-700">
        {state.kind === "loading" && (
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <Spinner /> Loading…
          </div>
        )}
        {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
        {state.kind === "ready" && (
          <>
            <p>
              Stop sending KDLMS newsletters to <strong>{state.maskedEmail}</strong>?
            </p>
            <p className="text-slate-500">
              You'll still get emails about your account, such as password resets.
            </p>
            {submitError && <Alert variant="error">{submitError}</Alert>}
            <Button onClick={() => void unsubscribe()} loading={submitting} className="w-full">
              Unsubscribe
            </Button>
          </>
        )}
        {state.kind === "done" && (
          <Alert variant="success">
            {state.maskedEmail} won't get KDLMS newsletters any more. You'll still get emails about
            your account.
          </Alert>
        )}
      </div>
    </AuthLayout>
  );
}
