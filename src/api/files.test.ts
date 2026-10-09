import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/api/client";
import { uploadMediaFile } from "@/api/files";

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return { ...actual, apiFetch: vi.fn(), putToPresignedUrl: vi.fn() };
});

const apiFetch = vi.mocked(client.apiFetch);
const putToPresignedUrl = vi.mocked(client.putToPresignedUrl);

function startedWith(partCount: number, partSizeBytes: number) {
  return {
    uploadId: "upload-1",
    partSizeBytes,
    parts: Array.from({ length: partCount }, (_, i) => ({ partNumber: i + 1, url: `https://bucket/part-${i + 1}` })),
    expiresAt: "2026-10-10T00:00:00Z",
  };
}

const stored = { fileId: "file-1", fileName: "clip.mp4", contentType: "video/mp4", sizeBytes: 10 };

function bodyOf(call: number) {
  return JSON.parse(apiFetch.mock.calls[call][1]!.body as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("uploadMediaFile", () => {
  it("slices the file by part size, PUTs every part, and completes with their ETags in order", async () => {
    apiFetch.mockResolvedValueOnce(startedWith(3, 4)).mockResolvedValueOnce(stored);
    const sizes: number[] = [];
    putToPresignedUrl.mockImplementation(async (url, body, options) => {
      sizes.push(body.size);
      options?.onProgress?.(body.size);
      return `"etag-${url.slice(-1)}"`;
    });
    const onProgress = vi.fn();
    const file = new File(["0123456789"], "clip.mp4", { type: "video/mp4" });

    await expect(uploadMediaFile(file, { onProgress })).resolves.toEqual(stored);

    expect(apiFetch.mock.calls[0][0]).toBe("/api/v1/files/multipart");
    expect(bodyOf(0)).toEqual({ fileName: "clip.mp4", contentType: "video/mp4", sizeBytes: 10 });
    expect(sizes.sort()).toEqual([2, 4, 4]);
    expect(apiFetch.mock.calls[1][0]).toBe("/api/v1/files/multipart/upload-1/complete");
    expect(bodyOf(1)).toEqual({
      parts: [
        { partNumber: 1, etag: '"etag-1"' },
        { partNumber: 2, etag: '"etag-2"' },
        { partNumber: 3, etag: '"etag-3"' },
      ],
    });
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

  it("refreshes an expired part URL and retries the part", async () => {
    vi.useFakeTimers();
    apiFetch
      .mockResolvedValueOnce(startedWith(1, 10))
      .mockResolvedValueOnce([{ partNumber: 1, url: "https://bucket/fresh" }])
      .mockResolvedValueOnce(stored);
    putToPresignedUrl
      .mockRejectedValueOnce(new client.PresignedUploadError(403))
      .mockResolvedValueOnce('"etag"');

    const upload = uploadMediaFile(new File(["0123456789"], "clip.mp4", { type: "video/mp4" }));
    await vi.runAllTimersAsync();

    await expect(upload).resolves.toEqual(stored);
    expect(apiFetch.mock.calls[1][0]).toBe("/api/v1/files/multipart/upload-1/part-urls");
    expect(putToPresignedUrl.mock.calls[1][0]).toBe("https://bucket/fresh");
  });

  it("discards the upload server-side when a part keeps failing", async () => {
    vi.useFakeTimers();
    apiFetch.mockResolvedValueOnce(startedWith(1, 10)).mockResolvedValue(undefined);
    putToPresignedUrl.mockRejectedValue(new client.PresignedUploadError(0));

    const upload = uploadMediaFile(new File(["0123456789"], "clip.mp4", { type: "video/mp4" }));
    const outcome = expect(upload).rejects.toBeInstanceOf(client.PresignedUploadError);
    await vi.runAllTimersAsync();
    await outcome;

    expect(putToPresignedUrl).toHaveBeenCalledTimes(3);
    expect(apiFetch).toHaveBeenLastCalledWith("/api/v1/files/multipart/upload-1", { method: "DELETE" });
  });

  it("aborts in-flight parts and discards the upload when cancelled", async () => {
    apiFetch.mockResolvedValueOnce(startedWith(2, 5)).mockResolvedValue(undefined);
    putToPresignedUrl.mockImplementation(
      (_url, _body, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener("abort", () => reject(new DOMException("Upload cancelled", "AbortError"))),
        ),
    );
    const controller = new AbortController();

    const upload = uploadMediaFile(new File(["0123456789"], "clip.mp4", { type: "video/mp4" }), {
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(putToPresignedUrl).toHaveBeenCalledTimes(2));
    controller.abort();

    await expect(upload).rejects.toThrow("Upload cancelled");
    expect(apiFetch).toHaveBeenLastCalledWith("/api/v1/files/multipart/upload-1", { method: "DELETE" });
  });
});
