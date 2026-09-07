import { useEffect, useRef, useState } from "react";

interface QuizTimerProps {
  /** ISO instant - null means untimed (no countdown is rendered). */
  deadlineAt: string | null;
  /** The server's own clock at the moment the current view was fetched, for clock-skew correction. */
  serverTime: string;
  /** Called once, the first time the countdown reaches zero. */
  onExpire: () => void;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * A server-authoritative countdown (Phase 20D) - see `quiz-module.md`'s
 * "Timer — server-authoritative". The client's own clock is never trusted
 * for anything but rendering: `offset` is computed once, from the
 * difference between the server's reported time and the browser's own
 * `Date.now()` at that moment, then every tick re-reads `Date.now()` and
 * re-applies that same fixed offset - a system clock change mid-quiz skews
 * the offset calculation identically on both sides and so cancels out,
 * rather than jumping the displayed countdown.
 */
export function QuizTimer({ deadlineAt, serverTime, onExpire }: QuizTimerProps) {
  const offsetRef = useRef<number>(0);
  const expiredRef = useRef(false);
  const announcedRef = useRef<{ fiveMinutes: boolean; oneMinute: boolean }>({
    fiveMinutes: false,
    oneMinute: false,
  });
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    offsetRef.current = new Date(serverTime).getTime() - Date.now();
  }, [serverTime]);

  useEffect(() => {
    // Untimed - nothing to synchronize; `remainingMs` starts (and stays) `null`.
    if (!deadlineAt) {
      return;
    }
    expiredRef.current = false;
    const deadlineMs = new Date(deadlineAt).getTime();

    function tick() {
      const correctedNow = Date.now() + offsetRef.current;
      const remaining = deadlineMs - correctedNow;
      setRemainingMs(remaining);

      if (remaining <= 5 * 60 * 1000 && !announcedRef.current.fiveMinutes) {
        announcedRef.current.fiveMinutes = true;
        setAnnouncement("5 minutes remaining.");
      }
      if (remaining <= 60 * 1000 && !announcedRef.current.oneMinute) {
        announcedRef.current.oneMinute = true;
        setAnnouncement("1 minute remaining.");
      }
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onExpire is stable enough for this session's lifetime; re-running on every render would restart the interval
  }, [deadlineAt]);

  if (!deadlineAt || remainingMs === null) {
    return null;
  }

  const low = remainingMs <= 60 * 1000;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-sm font-medium tabular-nums ${
        low ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <span aria-hidden="true">⏱</span>
      <span>{formatRemaining(remainingMs)}</span>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
