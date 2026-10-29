import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { type GateCodeView, publicGateCode } from "@/api/staffAttendance";
import { QrCode } from "../components/QrCode";

const STORAGE_KEY = "kdlms.staffGateToken";
/** Re-poll at least this often even when a code has longer left - so a re-pair elsewhere is noticed. */
const MAX_POLL_MS = 15_000;

function readToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // private mode / blocked storage: the token then lives only for this page load
  }
}

/** Takes a `#pair=<token>` handed over by the admin screen, then strips it from the address bar. */
function adoptPairingFragment(): string | null {
  const match = /^#pair=([A-Za-z0-9_-]+)$/.exec(window.location.hash);
  if (!match) {
    return null;
  }
  window.history.replaceState(null, "", window.location.pathname);
  writeToken(match[1]);
  return match[1];
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * The gate display (Phase 46): a screen left open at the staff entrance,
 * showing a QR that rotates every ~20 seconds. Staff scan it with their phone
 * camera, which opens /clock and asks for their fingerprint. Paired by a
 * long-lived station token (from the admin's "Open on a screen"), never a
 * user session - so it keeps working without anyone signed in.
 */
export function GatePage() {
  const [token, setToken] = useState<string | null>(() => adoptPairingFragment() ?? readToken());
  const [gate, setGate] = useState<GateCodeView | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    let timer: number | undefined;

    async function poll(stationToken: string) {
      try {
        const next = await publicGateCode(stationToken);
        if (cancelled) {
          return;
        }
        setGate(next);
        setOffline(false);
        timer = window.setTimeout(
          () => void poll(stationToken),
          Math.min(next.expiresInSeconds * 1000 + 250, MAX_POLL_MS),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          writeToken(null);
          setToken(null);
          setGate(null);
          return;
        }
        setOffline(true);
        timer = window.setTimeout(() => void poll(stationToken), 5_000);
      }
    }

    void poll(token);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  // Keep the screen awake where the browser allows it.
  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
    nav.wakeLock?.request("screen").then((sentinel) => (lock = sentinel)).catch(() => undefined);
    return () => {
      void lock?.release();
    };
  }, []);

  if (!token) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-900 p-8 text-center text-white">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">This screen isn&apos;t set up</h1>
          <p className="text-slate-300">
            In KDLMS, open Staff &amp; clock-in → Terminals &amp; gates, choose a gate and “Open on a screen”, then
            scan or open its link on this device.
          </p>
        </div>
      </main>
    );
  }

  const clockUrl = gate ? `${window.location.origin}/clock?s=${gate.stationId}&c=${encodeURIComponent(gate.code)}` : "";

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-slate-900 p-6 text-white">
      <div className="text-center">
        <p className="text-lg text-slate-300">{gate ? `${gate.schoolName} · ${gate.branchName}` : " "}</p>
        <h1 className="text-3xl font-semibold">{gate?.stationName ?? "Staff clock-in"}</h1>
      </div>
      <p className="text-6xl font-semibold tabular-nums" aria-live="off">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
      <div className="rounded-2xl bg-white p-4">
        {gate ? (
          <QrCode value={clockUrl} size={300} label="Scan to clock in" />
        ) : (
          <div className="h-[300px] w-[300px]" aria-hidden="true" />
        )}
      </div>
      <div className="text-center">
        <p className="text-xl">Scan with your phone camera to clock in or out</p>
        {offline && <p className="mt-2 text-amber-300">Reconnecting… the code may be out of date.</p>}
      </div>
    </main>
  );
}
