import { apiFetch, apiFetchBlob, apiFetchBlobWithProgress, apiUpload, type DownloadProgress } from "@/api/client";

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
  "audio/mpeg": 25 * 1024 * 1024,
  "video/mp4": 50 * 1024 * 1024,
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

/** Uploads a file (logo, signature, student photo, or - Phase 35D - a PDF/mp3/mp4) - see the backend `shared` FileStorage SPI. */
export function uploadFile(file: File): Promise<StoredFileView> {
  return apiUpload<StoredFileView>(BASE, file);
}

/** Fetches an uploaded file's bytes - pair with `URL.createObjectURL` for an `<img>`/`<video>`/`<audio>` source, never a bare `src` (the bucket is private, unreachable without an Authorization header). */
export function downloadFile(fileId: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/${fileId}`);
}

/** Like {@link downloadFile}, but reports download progress - for a large mp3/mp4 (e.g. a staff learning-resource preview) whose player shows a determinate progress bar rather than an indeterminate spinner. */
export function downloadFileWithProgress(
  fileId: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<Blob> {
  return apiFetchBlobWithProgress(`${BASE}/${fileId}`, onProgress);
}

export function deleteFile(fileId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${fileId}`, { method: "DELETE" });
}
