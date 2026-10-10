import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePauseWhenHidden } from "./usePauseWhenHidden";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePauseWhenHidden", () => {
  afterEach(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });

  it("calls onHide when the tab becomes hidden, not when it becomes visible", () => {
    const onHide = vi.fn();
    renderHook(() => usePauseWhenHidden(onHide));

    setVisibility("visible");
    expect(onHide).not.toHaveBeenCalled();

    setVisibility("hidden");
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("calls onHide when the window loses focus", () => {
    const onHide = vi.fn();
    renderHook(() => usePauseWhenHidden(onHide));

    window.dispatchEvent(new Event("blur"));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("ignores window blur when onBlur is false", () => {
    const onHide = vi.fn();
    renderHook(() => usePauseWhenHidden(onHide, { onBlur: false }));

    window.dispatchEvent(new Event("blur"));
    expect(onHide).not.toHaveBeenCalled();

    setVisibility("hidden");
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("uses the latest callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => usePauseWhenHidden(cb), { initialProps: { cb: first } });
    rerender({ cb: second });

    window.dispatchEvent(new Event("blur"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("removes its listeners on unmount", () => {
    const onHide = vi.fn();
    const { unmount } = renderHook(() => usePauseWhenHidden(onHide));
    unmount();

    window.dispatchEvent(new Event("blur"));
    setVisibility("hidden");
    expect(onHide).not.toHaveBeenCalled();
  });
});
