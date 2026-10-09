import {
  apiFetch,
  apiFetchBlob,
  apiUpload,
  PresignedUploadError,
  putToPresignedUrl,
} from "@/api/client";
import type { MediaStreamUrlView } from "@/api/learning";

const BASE = "/api/v1/files";

/**
 * Mirrors the backend's `kdlms.files.max-size-bytes` default (application.yml)
 * - the cap for the three image types. PDF/mp3/mp4 (Phase 35D) each carry
 * their own, larger cap - see `UPLOAD_LIMIT_BYTES`/`uploadLimitFor` below,
 * mirroring `kdlms.files.max-size-bytes-by-content-type`. Overriding either
 * side server-side without changing this leaves the hint stale - the server
 * check is still the real boundary either way.
 */
export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_LABEL = "2 MB";

/** Per-content-type caps, mirroring `kdlms.files.max-size-bytes-by-content-type`. Anything not listed falls back to the image default. */
export const UPLOAD_LIMIT_BYTES: Record<string, number> = {
  "application/pdf": 10 * 1024 * 1024,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 10 * 1024 * 1024,
  "application/msword": 10 * 1024 * 1024,
  "audio/mpeg": 50 * 1024 * 1024,
  "video/mp4": 150 * 1024 * 1024,
};

export function uploadLimitFor(contentType: string): number {
  return UPLOAD_LIMIT_BYTES[contentType] ?? MAX_IMAGE_UPLOAD_BYTES;
}

export function uploadLimitLabel(contentType: string): string {
  return `${Math.round(uploadLimitFor(contentType) / (1024 * 1024))} MB`;
}

/** Mirrors backend filestorage.adapter.in.web.FileController.StoredFileResponse. */
export interface StoredFileView {
  fileId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/** Uploads a file (logo, signature, student photo, PDF, lesson-note document) - see the backend `shared` FileStorage SPI. mp3/mp4 go through {@link uploadMediaFile} instead. */
export function uploadFile(file: File): Promise<StoredFileView> {
  return apiUpload<StoredFileView>(BASE, file);
}

/** Fetches an uploaded file's bytes - pair with `URL.createObjectURL` for an `<img>`/`<video>`/`<audio>` source, never a bare `src` (the bucket is private, unreachable without an Authorization header). */
export function downloadFile(fileId: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/${fileId}`);
}

/** A presigned bucket URL an mp3/mp4 plays from directly (e.g. a staff learning-resource preview) - the browser's media element makes its own `Range` requests, so nothing is downloaded up front. */
export function getFileMediaUrl(fileId: string): Promise<MediaStreamUrlView> {
  return apiFetch<MediaStreamUrlView>(`${BASE}/${fileId}/media-url`);
}

export function deleteFile(fileId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${fileId}`, { method: "DELETE" });
}

/** Mirrors backend `MultipartUploadController.StartedUploadResponse`. */
interface StartedUpload {
  uploadId: string;
  partSizeBytes: number;
  parts: PartUrl[];
  expiresAt: string;
}

interface PartUrl {
  partNumber: number;
  url: string;
}

interface UploadedPart {
  partNumber: number;
  etag: string;
}

export interface MediaUploadOptions {
  /** Called with the whole file's progress as a fraction from 0 to 1. */
  onProgress?: (fraction: number) => void;
  /** Aborting cancels every in-flight part and discards the upload server-side. */
  signal?: AbortSignal;
}

const MULTIPART_BASE = `${BASE}/multipart`;
/** Parts in flight at once - enough to fill a typical uplink without starving the rest of the page. */
const PART_CONCURRENCY = 3;
const PART_ATTEMPTS = 3;

/**
 * Uploads learning audio/video in parts, straight to the bucket: the API hands out a presigned URL
 * per part, the browser PUTs each slice of the file to its URL (a few at a time, each retried with
 * backoff, with fresh URLs fetched if one expired), then the API assembles and checks the result.
 * Resolves to the same {@link StoredFileView} {@link uploadFile} would. On failure or cancellation
 * the upload is discarded server-side (best effort - the server also sweeps abandoned ones).
 */
export async function uploadMediaFile(file: File, options: MediaUploadOptions = {}): Promise<StoredFileView> {
  const { onProgress, signal } = options;
  const started = await apiFetch<StartedUpload>(MULTIPART_BASE, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }),
    signal,
  });
  // Cancels the remaining parts as soon as one fails for good, as well as on the caller's abort.
  const inFlight = new AbortController();
  const cancelParts = () => inFlight.abort();
  signal?.addEventListener("abort", cancelParts, { once: true });
  if (signal?.aborted) {
    inFlight.abort();
  }
  const urls = new Map(started.parts.map((part) => [part.partNumber, part.url]));
  const loadedByPart = new Map<number, number>();
  const reportProgress = () => {
    let loaded = 0;
    loadedByPart.forEach((bytes) => (loaded += bytes));
    onProgress?.(file.size > 0 ? Math.min(1, loaded / file.size) : 1);
  };

  async function uploadPart(partNumber: number): Promise<UploadedPart> {
    const start = (partNumber - 1) * started.partSizeBytes;
    const slice = file.slice(start, Math.min(file.size, start + started.partSizeBytes));
    for (let attempt = 1; ; attempt++) {
      try {
        const etag = await putToPresignedUrl(urls.get(partNumber)!, slice, {
          signal: inFlight.signal,
          onProgress: (loaded) => {
            loadedByPart.set(partNumber, loaded);
            reportProgress();
          },
        });
        loadedByPart.set(partNumber, slice.size);
        reportProgress();
        return { partNumber, etag };
      } catch (err) {
        if (!(err instanceof PresignedUploadError) || attempt >= PART_ATTEMPTS) {
          throw err;
        }
        loadedByPart.set(partNumber, 0);
        if (err.status === 403) {
          // The URL's signature expired (a slow connection on a long file) - ask for a fresh one.
          const [fresh] = await apiFetch<PartUrl[]>(`${MULTIPART_BASE}/${started.uploadId}/part-urls`, {
            method: "POST",
            body: JSON.stringify({ partNumbers: [partNumber] }),
            signal: inFlight.signal,
          });
          urls.set(partNumber, fresh.url);
        }
        await delay(500 * 2 ** (attempt - 1), inFlight.signal);
      }
    }
  }

  try {
    const pending = started.parts.map((part) => part.partNumber);
    const uploaded: UploadedPart[] = [];
    const worker = async () => {
      for (let next = pending.shift(); next !== undefined; next = pending.shift()) {
        uploaded.push(await uploadPart(next));
      }
    };
    await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, pending.length) }, worker));
    uploaded.sort((a, b) => a.partNumber - b.partNumber);
    return await apiFetch<StoredFileView>(`${MULTIPART_BASE}/${started.uploadId}/complete`, {
      method: "POST",
      body: JSON.stringify({ parts: uploaded }),
    });
  } catch (err) {
    inFlight.abort();
    // Not awaited past its own failure: the original error is the one worth reporting.
    void apiFetch<void>(`${MULTIPART_BASE}/${started.uploadId}`, { method: "DELETE" }).catch(() => undefined);
    throw err;
  } finally {
    signal?.removeEventListener("abort", cancelParts);
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Upload cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}
