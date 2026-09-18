import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThrottledSave } from "@/hooks/useThrottledSave";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useThrottledSave", () => {
  it("collapses a burst of schedule calls to one trailing save at the interval", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useThrottledSave<number>({ onSave, intervalMs: 1000 }));

    act(() => {
      result.current.schedule(1);
      result.current.schedule(2);
      result.current.schedule(3);
    });
    expect(onSave).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(3);
  });

  it("saves periodically under continuous scheduling rather than never firing", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useThrottledSave<number>({ onSave, intervalMs: 1000 }));

    // A schedule call every 100ms for 2.5s - a continuous stream, the timeupdate shape.
    for (let elapsedMs = 0; elapsedMs < 2500; elapsedMs += 100) {
      act(() => {
        result.current.schedule(elapsedMs);
        vi.advanceTimersByTime(100);
      });
    }

    // A plain debounce (reset-on-every-call) would never have fired; this throttle fires roughly
    // once per interval regardless of the continuing stream.
    expect(onSave.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("flush saves immediately and cancels the pending timer", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useThrottledSave<string>({ onSave, intervalMs: 1000 }));

    act(() => result.current.schedule("value"));
    act(() => result.current.flush());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("value");

    // The timer that would have fired at 1000ms was cancelled by flush - advancing past it
    // triggers no second call.
    act(() => vi.advanceTimersByTime(1000));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("flush with nothing pending is a no-op", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useThrottledSave<string>({ onSave, intervalMs: 1000 }));

    act(() => result.current.flush());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("unmounting with a pending save does not auto-flush", () => {
    const onSave = vi.fn();
    const { result, unmount } = renderHook(() => useThrottledSave<string>({ onSave, intervalMs: 1000 }));

    act(() => result.current.schedule("value"));
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("defaults to a 15s interval when none is given", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useThrottledSave<string>({ onSave }));

    act(() => result.current.schedule("value"));
    act(() => vi.advanceTimersByTime(14_999));
    expect(onSave).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onSave).toHaveBeenCalledWith("value");
  });
});
