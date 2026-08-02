import { apiFetch, apiFetchBlob, apiUpload } from "@/api/client";

const BASE = "/api/v1/files";

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
