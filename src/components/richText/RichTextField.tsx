import { EditorContent, useEditor } from "@tiptap/react";
import {
  Bold,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Sigma,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, uploadFile } from "@/api/files";
import { Alert } from "@/components/ui/Alert";
import { MathDialog } from "@/components/richText/MathDialog";
import { richTextExtensions } from "@/components/richText/richTextExtensions";

interface RichTextFieldProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  /** Shows the image toolbar button - on for a question prompt and, since Phase 20J, a choice option's label too. */
  allowImages?: boolean;
  /** A choice option's label - no lists, and Enter is swallowed rather than starting a new line. */
  singleLine?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

interface MathDialogState {
  open: boolean;
  latex: string;
  /** The clicked node's position when editing an existing expression - `null` when inserting a new one. */
  pos: number | null;
}

const CLOSED_MATH_DIALOG: MathDialogState = { open: false, latex: "", pos: null };

/**
 * The WYSIWYG editor a take-home quiz question's prompt and choice options
 * are authored in - TipTap over the tiny vocabulary `richTextExtensions`
 * builds, so nothing this editor can produce falls outside what the backend
 * `QuizRichText` sanitizer allows. Mirrors `ImageUploadField`'s own
 * upload-immediately-hand-off-the-fileId contract for its image button,
 * and `MathText`/`katexHtml.ts`'s KaTeX safety argument for its maths
 * button - see `MathDialog`.
 */
export function RichTextField({
  id,
  value,
  onChange,
  allowImages = false,
  singleLine = false,
  disabled = false,
  ariaLabel,
}: RichTextFieldProps) {
  const [mathDialog, setMathDialog] = useState<MathDialogState>(CLOSED_MATH_DIALOG);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor(
    {
      extensions: richTextExtensions({
        allowLists: !singleLine,
        allowImages,
        onMathClick: (latex, pos) => setMathDialog({ open: true, latex, pos }),
      }),
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
    [singleLine, allowImages],
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
    if (mathDialog.pos !== null) {
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
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`Image is larger than ${MAX_UPLOAD_LABEL}. Please choose a smaller file.`);
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
        <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 p-1">
          <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Subscript" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}>
            <SubscriptIcon className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Superscript" active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
            <SuperscriptIcon className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          {!singleLine && (
            <>
              <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                <List className="h-4 w-4" aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                <ListOrdered className="h-4 w-4" aria-hidden="true" />
              </ToolbarButton>
            </>
          )}
          <ToolbarButton label="Insert maths" onClick={() => setMathDialog({ open: true, latex: "", pos: null })}>
            <Sigma className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          {allowImages && (
            <ToolbarButton label="Insert image" onClick={() => fileInputRef.current?.click()} loading={uploading}>
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            </ToolbarButton>
          )}
        </div>
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

function ToolbarButton({
  label,
  active = false,
  loading = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  loading?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={loading}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-control text-slate-600 hover:bg-slate-100 disabled:opacity-50 mobile:h-11 mobile:w-11 ${
        active ? "bg-brand-50 text-brand-600" : ""
      }`}
    >
      {children}
    </button>
  );
}
