import { CheckCircle2, Fingerprint, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  type AuthenticationOptionsView,
  type ClockResultView,
  publicClockIn,
  publicClockOptions,
} from "@/api/staffAttendance";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { describeWebAuthnError, getPasskeyAssertion, passkeysSupported } from "@/utils/webauthn";
import { PublicShell } from "./PublicShell";

type State =
  | { kind: "preparing" }
  | { kind: "ready"; options: AuthenticationOptionsView }
  | { kind: "verifying" }
  | { kind: "done"; result: ClockResultView }
  | { kind: "error"; message: string; rescan: boolean };

/**
 * What a staff member's phone opens after scanning the gate QR (Phase 46).
 * The gate code is redeemed for a two-minute challenge straight away - while
 * it's still current - and the fingerprint prompt then waits for a tap, since
 * phones only allow it from a user gesture.
 */
export function ClockInPage() {
  const [params] = useSearchParams();
  const stationId = params.get("s") ?? "";
  const code = params.get("c") ?? "";
  const upfrontError: State | null = !passkeysSupported()
    ? {
        kind: "error",
        message: "This browser can't use passkeys. Open the camera app's link in Chrome or Safari, or use the fingerprint terminal.",
        rescan: false,
      }
    : !stationId || !code
      ? { kind: "error", message: "Scan the QR code on the gate screen to clock in.", rescan: true }
      : null;
  const [flow, setFlow] = useState<State>({ kind: "preparing" });
  const state = upfrontError ?? flow;

  useEffect(() => {
    if (!passkeysSupported() || !stationId || !code) {
      return;
    }
    let cancelled = false;
    publicClockOptions(stationId, code)
      .then((options) => !cancelled && setFlow({ kind: "ready", options }))
      .catch((error: unknown) => {
        if (!cancelled) {
          setFlow({ kind: "error", message: getErrorMessage(error, "This gate code has expired."), rescan: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [stationId, code]);

  async function handleClock(options: AuthenticationOptionsView) {
    setFlow({ kind: "verifying" });
    try {
      const assertion = await getPasskeyAssertion(options);
      const result = await publicClockIn(stationId, options.challenge, assertion);
      setFlow({ kind: "done", result });
    } catch (error) {
      const isWebAuthn = error instanceof DOMException;
      setFlow({
        kind: "error",
        message: isWebAuthn ? describeWebAuthnError(error) : getErrorMessage(error, "Clock-in failed."),
        rescan: true,
      });
    }
  }

  return (
    <PublicShell>
      <Card className="space-y-6 p-8 text-center">
        {(state.kind === "preparing" || state.kind === "verifying") && (
          <>
            <Fingerprint className="mx-auto h-16 w-16 animate-pulse text-brand-500" aria-hidden="true" />
            <p className="text-slate-600">{state.kind === "preparing" ? "Getting ready…" : "Checking…"}</p>
          </>
        )}
        {state.kind === "ready" && (
          <>
            <Fingerprint className="mx-auto h-16 w-16 text-brand-500" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Staff clock-in</h1>
              <p className="mt-1 text-slate-600">Confirm it&apos;s you with your fingerprint or face.</p>
            </div>
            <Button size="lg" className="w-full" onClick={() => void handleClock(state.options)}>
              Clock in / out
            </Button>
          </>
        )}
        {state.kind === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" aria-hidden="true" />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900">
                {state.result.direction === "IN" ? "Clocked in" : "Clocked out"} at {state.result.localTime}
              </h1>
              <p className="text-lg text-slate-700">{state.result.staffName}</p>
              {state.result.late && <Badge variant="warning">Late</Badge>}
              {state.result.duplicate && (
                <p className="text-sm text-slate-500">You'd already clocked a moment ago - nothing new was recorded.</p>
              )}
            </div>
          </>
        )}
        {state.kind === "error" && (
          <>
            <XCircle className="mx-auto h-16 w-16 text-red-500" aria-hidden="true" />
            <p className="text-slate-700">{state.message}</p>
            {state.rescan && <p className="text-sm text-slate-500">Scan the QR code on the gate screen again.</p>}
          </>
        )}
      </Card>
    </PublicShell>
  );
}
