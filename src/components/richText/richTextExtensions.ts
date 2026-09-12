import { InlineMath } from "@tiptap/extension-mathematics";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import StarterKit from "@tiptap/starter-kit";
import { QuizImage } from "@/components/richText/quizImageNode";

/**
 * The one extension list every take-home quiz rich-text field is built
 * from - deliberately a tiny, closed vocabulary rather than StarterKit's
 * full default set, so the editor's own schema can never produce markup the
 * backend `QuizRichText` sanitizer would strip. `link`, `heading`,
 * `codeBlock`, `blockquote`, and `horizontalRule` are disabled outright:
 * nothing in this editor should ever be able to produce an `<a href>`, and
 * the rest simply aren't part of a quiz question's vocabulary. `bold` maps
 * to `<strong>`, `italic` to `<em>`, `strike` to `<s>`, `underline` to
 * `<u>`, `code` to `<code>`, the list trio to `<ul>`/`<ol>`/`<li>`, and
 * `hardBreak` to `<br>` - every one matching the backend safelist tag for
 * tag.
 * <p>
 * {@code allowLists} is off for a single-line field (a choice option) -
 * nothing about a short label needs a bullet list, and dropping it removes
 * one more way to produce multi-paragraph content there. {@code
 * allowImages} is independent of {@code allowLists}: a choice option's
 * label is single-line but, since Phase 20J, can still carry an image -
 * `QuizImage` is an inline atom node that lives inside the option's one
 * paragraph.
 */
export function richTextExtensions({
  allowLists,
  allowImages,
  onMathClick,
}: {
  allowLists: boolean;
  allowImages: boolean;
  /** Wired to `InlineMath`'s own click handler so `RichTextField`'s maths dialog can reopen pre-filled for an existing expression - omitted entirely by `RichContent`, which never edits anything. */
  onMathClick?: (latex: string, pos: number) => void;
}) {
  const extensions = [
    StarterKit.configure({
      link: false,
      heading: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
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
  return allowImages ? [...extensions, QuizImage] : extensions;
}
