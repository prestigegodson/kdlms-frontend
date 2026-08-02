import { ImagePlus, X } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { downloadFile, uploadFile } from "@/api/files";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface ImageUploadFieldProps {
  label: string;
  fileId?: string;
  onChange: (fileId: string | undefined) => void;
}

/**
 * Pick/upload an image (logo, principal/teacher signature) and preview it -
 * shared by the report-settings screen and the teacher directory's
 * signature control. The preview always goes through an authenticated blob
 * fetch and `URL.createObjectURL`, never a bare `<img src="/api/v1/files/...">`
 * - the files bucket is private and a plain `<img>` tag can't carry an
 * Authorization header.
 */
export function ImageUploadField({ label, fileId, onChange }: ImageUploadFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // `fileId` clearing to undefined (removed, or swapped to a different
  // upload) resets the stale preview during render rather than as a
  // synchronous setState in the effect below - the same pattern
  // `AdminResultsPanel`'s selectionKey/lastSelectionKey documents.
  const [lastFileId, setLastFileId] = useState(fileId);
  if (fileId !== lastFileId) {
    setLastFileId(fileId);
    if (!fileId) setPreviewUrl(null);
  }

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    downloadFile(fileId).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const stored = await uploadFile(file);
      onChange(stored.fileId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-panel border border-slate-200 bg-slate-50">
          {uploading ? (
            <Spinner />
          ) : previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus className="h-6 w-6 text-slate-400" aria-hidden="true" />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileSelected}
        />
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          {fileId ? "Replace" : "Upload"}
        </Button>
        {fileId && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
            onClick={() => onChange(undefined)}
          >
            <X className="h-4 w-4" aria-hidden="true" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}
