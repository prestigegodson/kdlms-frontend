import type { Editor } from "@tiptap/react";
import {
  Bold,
  Columns3,
  Combine,
  Heading2,
  Heading3,
  Heading4,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Minus as MinusIcon,
  Quote,
  Rows3,
  Sigma,
  SigmaSquare,
  Split,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table as TableIcon,
  Underline as UnderlineIcon,
} from "lucide-react";

export interface RichTextToolbarProps {
  editor: Editor;
  singleLine: boolean;
  allowImages: boolean;
  allowHeadings: boolean;
  allowTables: boolean;
  allowBlockMath: boolean;
  allowBlockquote: boolean;
  uploading: boolean;
  onInsertImageClick: () => void;
  onInsertMathClick: () => void;
  onInsertBlockMathClick: () => void;
}

/**
 * `RichTextField`'s toolbar, extracted once the lesson-note document editor
 * (Phase 16G) added four more gated groups on top of the take-home-quiz
 * editor's original set - headings, tables, displayed maths, and
 * blockquote/rule. Every new group stays off by default (`allowHeadings`
 * etc. default `false` in `richTextExtensions`), so a quiz's prompt/option
 * fields render exactly the toolbar they always have.
 */
export function RichTextToolbar({
  editor,
  singleLine,
  allowImages,
  allowHeadings,
  allowTables,
  allowBlockMath,
  allowBlockquote,
  uploading,
  onInsertImageClick,
  onInsertMathClick,
  onInsertBlockMathClick,
}: RichTextToolbarProps) {
  return (
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

      {allowHeadings && (
        <>
          <ToolbarButton
            label="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 4"
            active={editor.isActive("heading", { level: 4 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          >
            <Heading4 className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
        </>
      )}

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

      {allowBlockquote && (
        <>
          <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <MinusIcon className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
        </>
      )}

      <ToolbarButton label="Insert maths" onClick={onInsertMathClick}>
        <Sigma className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      {allowBlockMath && (
        <ToolbarButton label="Insert displayed maths" onClick={onInsertBlockMathClick}>
          <SigmaSquare className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
      )}

      {allowTables && (
        <>
          <ToolbarButton
            label="Insert table"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            <TableIcon className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Add row"
            disabled={!editor.can().addRowAfter()}
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <Rows3 className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Delete row"
            disabled={!editor.can().deleteRow()}
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            <Rows3 className="h-4 w-4 opacity-50" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Add column"
            disabled={!editor.can().addColumnAfter()}
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <Columns3 className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Delete column"
            disabled={!editor.can().deleteColumn()}
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            <Columns3 className="h-4 w-4 opacity-50" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Merge cells"
            disabled={!editor.can().mergeCells()}
            onClick={() => editor.chain().focus().mergeCells().run()}
          >
            <Combine className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            label="Split cell"
            disabled={!editor.can().splitCell()}
            onClick={() => editor.chain().focus().splitCell().run()}
          >
            <Split className="h-4 w-4" aria-hidden="true" />
          </ToolbarButton>
        </>
      )}

      {allowImages && (
        <ToolbarButton label="Insert image" onClick={onInsertImageClick} loading={uploading}>
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
        </ToolbarButton>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  active = false,
  loading = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={loading || disabled}
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
