import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, reloadOnce } from "@/utils/reloadOnce";

describe("reloadOnce", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reloads and reports success on the first call", () => {
    expect(reloadOnce()).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("skips a second reload within the guard window", () => {
    reloadOnce();
    expect(reloadOnce()).toBe(false);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("reloads again once the guard window has passed", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000);
    reloadOnce();
    nowSpy.mockReturnValue(1_000 + 11_000);

    expect(reloadOnce()).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(2);
  });

  it("still reloads when sessionStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(reloadOnce()).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});

describe("isChunkLoadError", () => {
  it("recognizes Vite's dynamic-import failure message", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
  });

  it("recognizes the older webpack ChunkLoadError name", () => {
    expect(isChunkLoadError(new Error("ChunkLoadError: Loading chunk 4 failed"))).toBe(true);
  });

  it("returns false for an unrelated error", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
  });

  it("handles a non-Error thrown value", () => {
    expect(isChunkLoadError("dynamically imported module failed")).toBe(true);
    expect(isChunkLoadError("boom")).toBe(false);
  });
});
