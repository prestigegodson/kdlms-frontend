import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRevalidateOnResume } from "./useRevalidateOnResume";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useRevalidateOnResume", () => {
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });

  it("revalidates when the tab becomes visible, not when it is hidden", () => {
    const revalidate = vi.fn();
    renderHook(() => useRevalidateOnResume(revalidate));

    setVisibility("hidden");
    expect(revalidate).not.toHaveBeenCalled();

    setVisibility("visible");
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it("revalidates on focus and when the browser comes back online", () => {
    const revalidate = vi.fn();
    renderHook(() => useRevalidateOnResume(revalidate, { minIntervalMs: 0 }));

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it("throttles the burst of events a resume fires", () => {
    vi.useFakeTimers();
    const revalidate = vi.fn();
    renderHook(() => useRevalidateOnResume(revalidate, { minIntervalMs: 30_000 }));

    setVisibility("visible");
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    expect(revalidate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    window.dispatchEvent(new Event("focus"));
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it("removes its listeners on unmount", () => {
    const revalidate = vi.fn();
    const { unmount } = renderHook(() => useRevalidateOnResume(revalidate));
    unmount();

    setVisibility("visible");
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    expect(revalidate).not.toHaveBeenCalled();
  });
});
