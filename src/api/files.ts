import { apiFetch, apiFetchBlob, apiUpload } from "@/api/client";

const BASE = "/api/v1/files";

/**
 * Mirrors the backend's `kdlms.files.max-size-bytes` default (application.yml).
 * Overriding `FILE_MAX_SIZE` server-side without changing this leaves the
 * hint stale - the server check is still the real boundary either way.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "2 MB";

/** Mirrors backend filestorage.adapter.in.web.FileController.StoredFileResponse. */
export interface StoredFileView {
  fileId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/** Uploads an image (logo, signature, student photo) - see the backend `shared` FileStorage SPI. */
export function uploadFile(file: File): Promise<StoredFileView> {
  return apiUpload<StoredFileView>(BASE, file);
}

/** Fetches an uploaded image's bytes - pair with `URL.createObjectURL` for an `<img>` source, never a bare `<img src>` (the bucket is private, unreachable without an Authorization header). */
export function downloadFile(fileId: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/${fileId}`);
}

export function deleteFile(fileId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${fileId}`, { method: "DELETE" });
}
