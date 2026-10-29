import { CheckCircle2, Fingerprint, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type EnrollmentInfoView,
  publicCompleteEnrollment,
  publicEnrollmentInfo,
  publicRegistrationOptions,
} from "@/api/staffAttendance";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  createPasskey,
  describeWebAuthnError,
  passkeysSupported,
  platformAuthenticatorAvailable,
} from "@/utils/webauthn";
import { PublicShell } from "./PublicShell";

type State =
  | { kind: "loading" }
  | { kind: "ready"; info: EnrollmentInfoView; hasBiometrics: boolean }
  | { kind: "saving"; info: EnrollmentInfoView }
  | { kind: "done"; info: EnrollmentInfoView }
  | { kind: "error"; message: string };

/** A rough label for the passkey list - "iPhone", "Android phone" - never sent anywhere but this school's admin. */
function deviceLabel(): string {
  const agent = navigator.userAgent;
  if (/iPhone/.test(agent)) return "iPhone";
  if (/iPad/.test(agent)) return "iPad";
  if (/Android/.test(agent)) return "Android phone";
  if (/Macintosh/.test(agent)) return "Mac";
  if (/Windows/.test(agent)) return "Windows PC";
  return "Phone";
}

/**
 * The one-time enrollment link (Phase 46): sets up a passkey on the staff
 * member's own phone, unlocked by its fingerprint or face. The biometric never
 * leaves the phone - KDLMS only stores the passkey's public key.
 */
export function StaffEnrollPage() {
  const { token = "" } = useParams();
  const unsupported: State | null = passkeysSupported()
    ? null
    : {
        kind: "error",
        message: "This browser can't create passkeys. Open the link in Chrome (Android) or Safari (iPhone), or ask your admin to enroll you on the fingerprint terminal.",
      };
  const [flow, setFlow] = useState<State>({ kind: "loading" });
  const state = unsupported ?? flow;

  useEffect(() => {
    let cancelled = false;
    if (!passkeysSupported()) {
      return;
    }
    Promise.all([publicEnrollmentInfo(token), platformAuthenticatorAvailable()])
      .then(([info, hasBiometrics]) => !cancelled && setFlow({ kind: "ready", info, hasBiometrics }))
      .catch((error: unknown) => {
        if (!cancelled) {
          setFlow({ kind: "error", message: getErrorMessage(error, "This enrollment link is invalid or has expired.") });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleEnroll(info: EnrollmentInfoView) {
    setFlow({ kind: "saving", info });
    try {
      const options = await publicRegistrationOptions(token);
      const credential = await createPasskey(options);
      await publicCompleteEnrollment(token, { challenge: options.challenge, credential, label: deviceLabel() });
      setFlow({ kind: "done", info });
    } catch (error) {
      setFlow({
        kind: "error",
        message: error instanceof DOMException ? describeWebAuthnError(error) : getErrorMessage(error, "Setup failed."),
      });
    }
  }

  return (
    <PublicShell>
      <Card className="space-y-6 p-8 text-center">
        {state.kind === "loading" && <Fingerprint className="mx-auto h-16 w-16 animate-pulse text-brand-500" aria-hidden="true" />}
        {(state.kind === "ready" || state.kind === "saving") && (
          <>
            <Fingerprint className="mx-auto h-16 w-16 text-brand-500" aria-hidden="true" />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900">Hi {state.info.staffName}</h1>
              <p className="text-slate-600">
                Set up fingerprint clock-in for <strong>{state.info.schoolName}</strong> on this phone. Your
                fingerprint never leaves your phone.
              </p>
              {state.kind === "ready" && !state.hasBiometrics && (
                <p className="text-sm text-amber-700">
                  This phone has no fingerprint or face unlock set up, so it will ask for your screen lock instead.
                </p>
              )}
            </div>
            <Button
              size="lg"
              className="w-full"
              loading={state.kind === "saving"}
              onClick={() => void handleEnroll(state.info)}
            >
              Set up clock-in
            </Button>
          </>
        )}
        {state.kind === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" aria-hidden="true" />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900">You&apos;re all set</h1>
              <p className="text-slate-600">
                To clock in or out, scan the QR code on the gate screen at {state.info.schoolName} with this phone.
              </p>
            </div>
          </>
        )}
        {state.kind === "error" && (
          <>
            <XCircle className="mx-auto h-16 w-16 text-red-500" aria-hidden="true" />
            <p className="text-slate-700">{state.message}</p>
          </>
        )}
      </Card>
    </PublicShell>
  );
}
