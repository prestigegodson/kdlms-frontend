import { Camera, FileText, Paperclip, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PaymentAttachmentView } from "@/api/feePayments";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { CompressImageError, compressImage } from "@/utils/compressImage";

/** Mirrors backend FeePayment.MAX_ATTACHMENTS. */
export const MAX_PAYMENT_ATTACHMENTS = 3;

/** Mirrors backend PaymentAttachmentPolicy's PDF cap - photos are compressed under the image cap instead. */
const PDF_MAX_BYTES = 10 * 1024 * 1024;

interface PaymentProofPickerProps {
  /** Attachments already on the payment being edited that are being kept. */
  existing: PaymentAttachmentView[];
  onRemoveExisting: (fileId: string) => void;
  /** New files to upload - photos already compressed to JPEG. */
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** A guardian must attach proof (D14); an admin recording a payment needn't. */
  required: boolean;
  disabled?: boolean;
}

/**
 * Proof of a fee payment (Phase 45, D14): up to three photos or PDFs, taken with the phone's
 * camera or chosen from its files. Every photo is re-encoded by `compressImage` before it's
 * accepted, so it fits the backend's 2 MB image cap whatever the camera produced; a PDF is kept
 * as-is under its 10 MB cap. Anything else is refused here, before an upload is ever attempted.
 */
export function PaymentProofPicker({
  existing,
  onRemoveExisting,
  files,
  onFilesChange,
  required,
  disabled = false,
}: PaymentProofPickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const chooserRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const count = existing.length + files.length;
  const remaining = MAX_PAYMENT_ATTACHMENTS - count;
  const full = remaining <= 0;

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) {
      return;
    }
    const picked = Array.from(list);
    const problems: string[] = [];
    if (picked.length > remaining) {
      problems.push(`You can attach at most ${MAX_PAYMENT_ATTACHMENTS} files - only the first ${remaining} were added.`);
    }
    setProcessing(true);
    const accepted: File[] = [];
    for (const file of picked.slice(0, Math.max(remaining, 0))) {
      if (file.type === "application/pdf") {
        if (file.size > PDF_MAX_BYTES) {
          problems.push(`"${file.name}" is larger than 10 MB.`);
        } else {
          accepted.push(file);
        }
      } else if (file.type.startsWith("image/") || file.type === "") {
        try {
          accepted.push(await compressImage(file));
        } catch (error) {
          problems.push(error instanceof CompressImageError ? error.message : `"${file.name}" couldn't be added.`);
        }
      } else {
        problems.push(`"${file.name}" isn't a photo or a PDF.`);
      }
    }
    setProcessing(false);
    setErrors(problems);
    if (accepted.length > 0) {
      onFilesChange([...files, ...accepted]);
    }
  }

  function pick(input: HTMLInputElement | null) {
    input?.click();
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-700">
          Proof of payment{required ? "" : " (optional)"}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          A photo or screenshot of the transfer receipt or deposit slip, or a PDF - up to {MAX_PAYMENT_ATTACHMENTS} files.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          className="min-h-11 w-full"
          disabled={disabled || full || processing}
          onClick={() => pick(cameraRef.current)}
        >
          <Camera className="h-4 w-4" aria-hidden="true" /> Take photo
        </Button>
        <Button
          variant="secondary"
          className="min-h-11 w-full"
          disabled={disabled || full || processing}
          onClick={() => pick(chooserRef.current)}
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" /> Choose file
        </Button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Take photo"
        data-testid="proof-camera-input"
        onChange={(event) => {
          void addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={chooserRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        aria-label="Choose file"
        data-testid="proof-file-input"
        onChange={(event) => {
          void addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {processing && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Preparing photo…
        </p>
      )}
      {errors.length > 0 && (
        <Alert variant="error">
          <ul className="space-y-0.5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {count > 0 && (
        <ul className="grid grid-cols-3 gap-2" aria-label="Attached files">
          {existing.map((attachment) => (
            <AttachmentTile
              key={attachment.fileId}
              name={attachment.fileName}
              disabled={disabled}
              onRemove={() => onRemoveExisting(attachment.fileId)}
            />
          ))}
          {files.map((file, index) => (
            <AttachmentTile
              key={`${file.name}-${index}`}
              name={file.name}
              file={file}
              disabled={disabled}
              onRemove={() => onFilesChange(files.filter((_, other) => other !== index))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachmentTile({
  name,
  file,
  disabled,
  onRemove,
}: {
  name: string;
  file?: File;
  disabled: boolean;
  onRemove: () => void;
}) {
  // A memo, not state set from an effect - the URL is derived from the file; the effect only
  // releases it once the tile unmounts or its file changes.
  const previewUrl = useMemo(
    () =>
      file && file.type.startsWith("image/") && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(file)
        : null,
    [file],
  );
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <li className="relative aspect-square overflow-hidden rounded-control border border-slate-200 bg-slate-50">
      {previewUrl ? (
        <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
          <FileText className="h-6 w-6 text-slate-400" aria-hidden="true" />
          <span className="line-clamp-2 break-all text-xs text-slate-600">{name}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${name}`}
        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-slate-600 disabled:opacity-50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white">
          <X className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>
    </li>
  );
}
