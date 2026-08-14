import { ImagePlus, X } from "lucide-react";
import { type ChangeEvent, useId, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { downloadFile, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, uploadFile } from "@/api/files";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useObjectUrl } from "@/hooks/useObjectUrl";

interface ImageUploadFieldProps {
  label: string;
  fileId?: string;
  onChange: (fileId: string | undefined) => void;
}

/**
 * Pick/upload an image and preview it - shared by the report-settings
 * screen's logo/signature fields, the teacher directory's signature
 * control, and the student detail page's photo control. Uploads immediately
 * to `POST /api/v1/files` and hands the resulting `fileId` up via
 * `onChange`; the parent screen is responsible for persisting it. The
 * preview always goes through `useObjectUrl` (an authenticated blob fetch)
 * rather than a bare `<img src="/api/v1/files/...">` - the files bucket is
 * private and a plain `<img>` tag can't carry an Authorization header.
 */
export function ImageUploadField({ label, fileId, onChange }: ImageUploadFieldProps) {
  const previewUrl = useObjectUrl(fileId, downloadFile);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`Image is larger than ${MAX_UPLOAD_LABEL}. Please choose a smaller file.`);
      return;
    }
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
          aria-describedby={hintId}
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
      <p id={hintId} className="mt-1 text-xs text-slate-500">
        PNG, JPEG or WebP · max {MAX_UPLOAD_LABEL}
      </p>
    </div>
  );
}
