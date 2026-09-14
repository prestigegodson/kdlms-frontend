import type { Extensions } from "@tiptap/core";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { QuizImage } from "@/components/richText/quizImageNode";

/**
 * The one extension list every rich-text field in the codebase is built
 * from - deliberately a tiny, closed vocabulary rather than StarterKit's
 * full default set, so an editor's own schema can never produce markup its
 * backend sanitizer would strip (`takehomequiz.domain.QuizRichText` for a
 * quiz prompt/option, `lessonnote.domain.LessonNoteRichText` for a lesson
 * note's document-mode body - see the latter's Javadoc for the exact tag
 * list this mirrors). `link` and `codeBlock` are disabled outright:
 * nothing in this editor should ever be able to produce an `<a href>`, and
 * a lesson plan has no use for a code block. `bold` maps to `<strong>`,
 * `italic` to `<em>`, `strike` to `<s>`, `underline` to `<u>`, `code` to
 * `<code>`, the list trio to `<ul>`/`<ol>`/`<li>`, and `hardBreak` to
 * `<br>` - every one matching the backend safelist tag for tag.
 * <p>
 * {@code allowLists} is off for a single-line field (a quiz choice option) -
 * nothing about a short label needs a bullet list, and dropping it removes
 * one more way to produce multi-paragraph content there. {@code
 * allowImages} is independent of {@code allowLists}: a choice option's
 * label is single-line but, since Phase 20J, can still carry an image -
 * `QuizImage` is an inline atom node that lives inside the option's one
 * paragraph. {@code allowHeadings}/{@code allowTables}/{@code
 * allowBlockMath}/{@code allowBlockquote} (Phase 16G) are the lesson note
 * document editor's own widened vocabulary - each stays off by default so
 * a quiz's prompt/option fields are unaffected.
 */
export function richTextExtensions({
  allowLists,
  allowImages,
  allowHeadings = false,
  allowTables = false,
  allowBlockMath = false,
  allowBlockquote = false,
  onMathClick,
  onBlockMathClick,
}: {
  allowLists: boolean;
  allowImages: boolean;
  allowHeadings?: boolean;
  allowTables?: boolean;
  allowBlockMath?: boolean;
  allowBlockquote?: boolean;
  /** Wired to `InlineMath`'s own click handler so `RichTextField`'s maths dialog can reopen pre-filled for an existing expression - omitted entirely by `RichContent`, which never edits anything. */
  onMathClick?: (latex: string, pos: number) => void;
  /** Same as `onMathClick`, for a displayed (`block-math`) expression - independent since the two are separate toolbar actions. */
  onBlockMathClick?: (latex: string, pos: number) => void;
}) {
  const extensions: Extensions = [
    StarterKit.configure({
      link: false,
      codeBlock: false,
      heading: allowHeadings ? { levels: [2, 3, 4] } : false,
      blockquote: allowBlockquote ? {} : false,
      horizontalRule: allowBlockquote ? {} : false,
      bulletList: allowLists ? {} : false,
      orderedList: allowLists ? {} : false,
      listItem: allowLists ? {} : false,
    }),
    Subscript,
    Superscript,
    InlineMath.configure({
      katexOptions: { throwOnError: false, trust: false, strict: "ignore" },
      onClick: onMathClick ? (node, pos) => onMathClick(node.attrs.latex as string, pos) : undefined,
    }),
  ];
  if (allowBlockMath) {
    extensions.push(
      BlockMath.configure({
        katexOptions: { throwOnError: false, trust: false, strict: "ignore", displayMode: true },
        onClick: onBlockMathClick ? (node, pos) => onBlockMathClick(node.attrs.latex as string, pos) : undefined,
      }),
    );
  }
  if (allowTables) {
    extensions.push(TableKit.configure({ table: { resizable: false } }));
  }
  return allowImages ? [...extensions, QuizImage] : extensions;
}
