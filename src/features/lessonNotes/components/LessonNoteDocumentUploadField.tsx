import { Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { downloadFile, uploadFile, uploadLimitFor, uploadLimitLabel } from "@/api/files";
import type { LessonNoteDocumentView } from "@/api/lessonNotes";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  DOC_TYPE,
  DOCX_TYPE,
  LessonNoteDocumentViewer,
  PDF_TYPE,
} from "@/features/lessonNotes/components/LessonNoteDocumentViewer";

const ACCEPTED_TYPES = [PDF_TYPE, DOCX_TYPE, DOC_TYPE];
// Some browsers/OSes report an empty or generic type for Word files, so the extension decides then.
const TYPE_BY_EXTENSION: Record<string, string> = { pdf: PDF_TYPE, docx: DOCX_TYPE, doc: DOC_TYPE };

function contentTypeOf(file: File): string | null {
  if (ACCEPTED_TYPES.includes(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXTENSION[extension] ?? null;
}

interface LessonNoteDocumentUploadFieldProps {
  document: LessonNoteDocumentView | null;
  onChange: (document: LessonNoteDocumentView | null) => void;
}

/**
 * Picks and uploads an `UPLOAD`-mode lesson note's file (a PDF, .docx or legacy .doc) through the
 * ordinary `POST /api/v1/files`, then previews it with the same viewer reviewers see. Replacing or
 * removing the file only changes the note once it's saved.
 */
export function LessonNoteDocumentUploadField({ document, onChange }: LessonNoteDocumentUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    const declaredType = contentTypeOf(file);
    if (!declaredType) {
      setError("Choose a PDF or Word document (.pdf, .docx or .doc).");
      return;
    }
    if (file.size > uploadLimitFor(declaredType)) {
      setError(`This file is too large - the limit is ${uploadLimitLabel(declaredType)}.`);
      return;
    }
    setUploading(true);
    try {
      // Re-wrapped so the multipart part carries the resolved type even when the browser left it blank.
      const typed = file.type === declaredType ? file : new File([file], file.name, { type: declaredType });
      const stored = await uploadFile(typed);
      onChange({
        fileId: stored.fileId,
        fileName: stored.fileName,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
      });
    } catch (uploadError) {
      setError(uploadError instanceof ApiError ? uploadError.message : "Failed to upload this document.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={`.pdf,.docx,.doc,${ACCEPTED_TYPES.join(",")}`}
        className="sr-only"
        aria-label="Lesson note document"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {document ? "Replace file" : "Choose file"}
        </Button>
        {document && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove
          </Button>
        )}
        <span className="text-xs text-slate-500">PDF or Word (.docx, .doc), up to {uploadLimitLabel(PDF_TYPE)}.</span>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {document && <LessonNoteDocumentViewer document={document} fetchFile={downloadFile} />}
    </div>
  );
}
