import { useCallback, useEffect, useRef } from "react";

export interface UseThrottledSaveOptions<T> {
  /** Called with the most recently scheduled value, no more than once per `intervalMs`. */
  onSave: (value: T) => Promise<void> | void;
  /** Default 15_000ms - the "~15s" figure `student-portal-plan.md`'s 35H.1 names for the audio/video position autosave. */
  intervalMs?: number;
}

export interface UseThrottledSaveResult<T> {
  /**
   * Records `value` as the latest pending save. If no timer is currently running, one is armed
   * for `intervalMs` from now; if one is already running (a burst of calls arriving faster than
   * the interval - e.g. a media element's `timeupdate` firing several times a second), this call
   * only replaces the pending value and does *not* reset the timer, so a continuous stream of
   * calls still saves periodically rather than never (the distinction from a plain debounce,
   * which would keep pushing the save out forever under continuous input).
   */
  schedule: (value: T) => void;
  /**
   * Saves the latest pending value immediately (if any) and cancels any running timer - for a
   * blur, an unmount, or another moment that demands the freshest value right away. A no-op if
   * nothing is pending.
   */
  flush: () => void;
}

const DEFAULT_INTERVAL_MS = 15_000;

/**
 * A periodic (not debounced) throttle for an autosave call - generalizes the shape
 * `TakeHomeQuizPublicPage`'s own inlined `scheduleSave`/`flushAnswers` pair already uses for quiz
 * answers into a reusable hook (Phase 35H), for the learning module's audio/video resume-position
 * autosave. Unmounting with a save still pending does **not** auto-flush - a caller that needs the
 * last position saved on navigate-away (the resume-point use case) calls `flush()` from its own
 * cleanup, since only the caller knows whether an unsent value is still worth persisting then.
 */
export function useThrottledSave<T>(options: UseThrottledSaveOptions<T>): UseThrottledSaveResult<T> {
  const onSaveRef = useRef(options.onSave);
  // Refs are for effects/handlers, never render, per the react-hooks/refs rule - so `onSave`'s
  // latest identity is committed here rather than assigned directly in the function body above.
  useEffect(() => {
    onSaveRef.current = options.onSave;
  });
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  const pendingRef = useRef<{ value: T } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    void onSaveRef.current(pending.value);
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pendingRef.current = { value };
      if (timeoutRef.current) return;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = undefined;
        flush();
      }, intervalMs);
    },
    [flush, intervalMs],
  );

  // Cancels a running timer on unmount - deliberately no flush here (see this hook's own doc
  // comment on `flush`); a component wanting the last value saved at unmount calls flush() itself.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { schedule, flush };
}
