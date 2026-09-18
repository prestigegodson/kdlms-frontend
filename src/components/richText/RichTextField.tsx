import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_LABEL, uploadFile } from "@/api/files";
import { Alert } from "@/components/ui/Alert";
import { MathDialog } from "@/components/richText/MathDialog";
import { PastedImageUpload } from "@/components/richText/pastedImageUpload";
import { richTextExtensions } from "@/components/richText/richTextExtensions";
import { RichTextToolbar } from "@/components/richText/RichTextToolbar";

interface RichTextFieldProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  /** Shows the image toolbar button - on for a question prompt and, since Phase 20J, a choice option's label too. */
  allowImages?: boolean;
  /** A choice option's label - no lists, and Enter is swallowed rather than starting a new line. */
  singleLine?: boolean;
  /** The lesson-note document editor's widened vocabulary (Phase 16G) - every flag defaults `false`, so a quiz field is unaffected. */
  allowHeadings?: boolean;
  allowTables?: boolean;
  allowBlockMath?: boolean;
  allowBlockquote?: boolean;
  /** Total images this field may hold across every paste and every image-button insert combined - required whenever `allowImages` is on. */
  maxImages?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

interface MathDialogState {
  open: boolean;
  latex: string;
  /** The clicked node's position when editing an existing expression - `null` when inserting a new one. */
  pos: number | null;
  /** Which command family the dialog's Insert/Update button should drive. */
  target: "inline" | "block";
}

const CLOSED_MATH_DIALOG: MathDialogState = { open: false, latex: "", pos: null, target: "inline" };

/**
 * The WYSIWYG editor a take-home quiz question's prompt/choice options and,
 * since Phase 16G, a lesson note's free-form document body are authored in -
 * TipTap over the closed vocabulary `richTextExtensions` builds, so nothing
 * this editor can produce falls outside what the matching backend sanitizer
 * allows (`takehomequiz.domain.QuizRichText` or `lessonnote.domain.LessonNoteRichText`).
 * Mirrors `ImageUploadField`'s own upload-immediately-hand-off-the-fileId
 * contract for its image button (and, for a pasted image, `pastedImageUpload.ts`'s
 * upload-then-rewrite contract), and `MathText`/`katexHtml.ts`'s KaTeX safety
 * argument for its maths buttons - see `MathDialog`.
 */
export function RichTextField({
  id,
  value,
  onChange,
  allowImages = false,
  singleLine = false,
  allowHeadings = false,
  allowTables = false,
  allowBlockMath = false,
  allowBlockquote = false,
  maxImages,
  disabled = false,
  ariaLabel,
}: RichTextFieldProps) {
  const [mathDialog, setMathDialog] = useState<MathDialogState>(CLOSED_MATH_DIALOG);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pasteStatus, setPasteStatus] = useState<{ uploading: number } | null>(null);
  const [droppedImageCount, setDroppedImageCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor(
    {
      extensions: [
        ...richTextExtensions({
          allowLists: !singleLine,
          allowImages,
          allowHeadings,
          allowTables,
          allowBlockMath,
          allowBlockquote,
          onMathClick: (latex, pos) => setMathDialog({ open: true, latex, pos, target: "inline" }),
          onBlockMathClick: (latex, pos) => setMathDialog({ open: true, latex, pos, target: "block" }),
        }),
        ...(allowImages
          ? [
              PastedImageUpload.configure({
                uploadFile,
                maxUploadBytes: MAX_IMAGE_UPLOAD_BYTES,
                maxImages: () => maxImages ?? Number.POSITIVE_INFINITY,
                onUploadStart: (count) => setPasteStatus({ uploading: count }),
                onUploadEnd: () => setPasteStatus(null),
                onDropped: (count) => setDroppedImageCount(count),
              }),
            ]
          : []),
      ],
      content: value || "<p></p>",
      editable: !disabled,
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: {
          ...(id ? { id } : {}),
          ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
          class: "rich-text-content min-h-11 px-3 py-2 text-sm text-slate-900 focus:outline-none mobile:text-base",
        },
        handleKeyDown: singleLine ? (_view, event) => event.key === "Enter" : undefined,
      },
      onUpdate: ({ editor: current }) => onChange(current.getHTML()),
    },
    // Recreated only when the field's shape changes - see richTextExtensions.ts's
    // note on why a fresh onMathClick closure each render is still safe here.
    [singleLine, allowImages, allowHeadings, allowTables, allowBlockMath, allowBlockquote],
  );

  // Keeps the editor in sync with an externally-driven `value` (loading a
  // saved question, or QuestionEditor's blankQuestion() reset) without
  // fighting the user's own typing - only pushed when it actually differs
  // from what the editor already holds, and never re-emits onUpdate.
  useEffect(() => {
    if (!editor) {
      return;
    }
    const next = value || "<p></p>";
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return null;
  }

  function submitMath(latex: string) {
    if (!editor) return;
    if (mathDialog.target === "block") {
      if (mathDialog.pos !== null) {
        editor.chain().focus().updateBlockMath({ latex, pos: mathDialog.pos }).run();
      } else {
        editor.chain().focus().insertBlockMath({ latex }).run();
      }
    } else if (mathDialog.pos !== null) {
      editor.chain().focus().updateInlineMath({ latex, pos: mathDialog.pos }).run();
    } else {
      editor.chain().focus().insertInlineMath({ latex }).run();
    }
    setMathDialog(CLOSED_MATH_DIALOG);
  }

  async function handleImageSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor) return;
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      setUploadError(`Image is larger than ${MAX_IMAGE_UPLOAD_LABEL}. Please choose a smaller file.`);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const stored = await uploadFile(file);
      editor.chain().focus().insertQuizImage({ fileId: stored.fileId }).run();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={`rounded-control border border-slate-300 bg-white ${disabled ? "bg-slate-100" : ""}`}>
      {!disabled && (
        <RichTextToolbar
          editor={editor}
          singleLine={singleLine}
          allowImages={allowImages}
          allowHeadings={allowHeadings}
          allowTables={allowTables}
          allowBlockMath={allowBlockMath}
          allowBlockquote={allowBlockquote}
          uploading={uploading}
          onInsertImageClick={() => fileInputRef.current?.click()}
          onInsertMathClick={() => setMathDialog({ open: true, latex: "", pos: null, target: "inline" })}
          onInsertBlockMathClick={() => setMathDialog({ open: true, latex: "", pos: null, target: "block" })}
        />
      )}
      {allowImages && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleImageSelected}
        />
      )}
      {uploadError && (
        <div className="px-2 pt-2">
          <Alert variant="error">{uploadError}</Alert>
        </div>
      )}
      {pasteStatus && (
        <div className="px-2 pt-2 text-xs text-slate-500">
          Uploading {pasteStatus.uploading} image{pasteStatus.uploading === 1 ? "" : "s"}…
        </div>
      )}
      {droppedImageCount > 0 && (
        <div className="flex items-start gap-2 px-2 pt-2">
          <Alert variant="warning" className="flex-1">
            {droppedImageCount} pasted image{droppedImageCount === 1 ? "" : "s"} couldn't be brought across. Use the
            image button to add {droppedImageCount === 1 ? "it" : "them"} instead.
          </Alert>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDroppedImageCount(0)}
            className="mt-1 text-xs text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      <MathDialog
        open={mathDialog.open}
        initialLatex={mathDialog.latex}
        onSubmit={submitMath}
        onClose={() => setMathDialog(CLOSED_MATH_DIALOG)}
      />
    </div>
  );
}
