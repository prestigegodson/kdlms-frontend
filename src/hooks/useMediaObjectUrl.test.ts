import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DownloadProgress } from "@/api/client";
import { useMediaObjectUrl } from "@/hooks/useMediaObjectUrl";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => vi.restoreAllMocks());

describe("useMediaObjectUrl", () => {
  it("reports progress as the fetcher calls back, then resolves to an object URL", async () => {
    const download = deferred<Blob>();
    let capturedOnProgress: ((progress: DownloadProgress) => void) | null = null;
    const fetcher = vi.fn((_key: string, onProgress: (progress: DownloadProgress) => void) => {
      capturedOnProgress = onProgress;
      return download.promise;
    });

    const { result } = renderHook(() => useMediaObjectUrl("resource-1", fetcher));

    expect(result.current.url).toBeNull();
    expect(result.current.error).toBe(false);

    act(() => capturedOnProgress?.({ loadedBytes: 50, totalBytes: 100 }));
    expect(result.current.loadedBytes).toBe(50);
    expect(result.current.totalBytes).toBe(100);

    await act(async () => {
      download.resolve(new Blob(["fake-mp4-bytes"], { type: "video/mp4" }));
      await download.promise;
    });

    expect(result.current.url).toMatch(/^blob:/);
  });

  it("sets error when the fetch rejects, without throwing out of the hook", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("network down")));

    const { result } = renderHook(() => useMediaObjectUrl("resource-1", fetcher));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe(true);
    expect(result.current.url).toBeNull();
  });

  it("resets to idle when the key changes to a different resource", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Blob(["fake-mp4-bytes"])));

    const { result, rerender } = renderHook(({ key }: { key: string | undefined }) => useMediaObjectUrl(key, fetcher), {
      initialProps: { key: "resource-1" },
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.url).toMatch(/^blob:/);

    rerender({ key: "resource-2" });
    expect(result.current.url).toBeNull();
    expect(result.current.loadedBytes).toBe(0);
    expect(result.current.totalBytes).toBeNull();
  });

  it("revokes the object URL on unmount", async () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    const fetcher = vi.fn(() => Promise.resolve(new Blob(["fake-mp4-bytes"])));

    const { result, unmount } = renderHook(() => useMediaObjectUrl("resource-1", fetcher));

    await act(async () => {
      await Promise.resolve();
    });
    const url = result.current.url;
    expect(url).toMatch(/^blob:/);

    unmount();
    expect(revokeSpy).toHaveBeenCalledWith(url);
  });

  it("does nothing when key is undefined", () => {
    const fetcher = vi.fn(() => Promise.resolve(new Blob()));

    const { result } = renderHook(() => useMediaObjectUrl(undefined, fetcher));

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.url).toBeNull();
  });
});
