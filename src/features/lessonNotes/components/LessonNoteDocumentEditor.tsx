import { RichTextField } from "@/components/richText/RichTextField";

/** Mirrors backend `lessonnote.domain.LessonNoteRichText.MAX_IMAGES_PER_NOTE`. */
const MAX_IMAGES_PER_NOTE = 30;

interface LessonNoteDocumentEditorProps {
  body: string;
  onChange: (body: string) => void;
  disabled?: boolean;
}

/**
 * The free-form "document" half of a lesson note (Phase 16G) - a single
 * full-page `RichTextField` canvas a teacher types into or pastes a
 * Microsoft Word lesson plan into, with the widened vocabulary
 * `lessonnote.domain.LessonNoteRichText` sanitizes on save: headings,
 * tables, images (auto-uploaded on paste - see `pastedImageUpload.ts`),
 * inline and displayed maths, lists, blockquote/rule, and the usual inline
 * marks. Sibling to `StructuredLessonNoteForm` - `LessonNoteEditorPage`
 * renders exactly one of the two depending on `content.mode`.
 */
export function LessonNoteDocumentEditor({ body, onChange, disabled = false }: LessonNoteDocumentEditorProps) {
  return (
    <RichTextField
      value={body}
      onChange={onChange}
      disabled={disabled}
      allowImages
      allowHeadings
      allowTables
      allowBlockMath
      allowBlockquote
      maxImages={MAX_IMAGES_PER_NOTE}
      ariaLabel="Lesson plan document"
    />
  );
}
