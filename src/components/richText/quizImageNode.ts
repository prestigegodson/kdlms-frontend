import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { QuizImageNodeView } from "@/components/richText/QuizImageNodeView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    quizImage: {
      insertQuizImage: (options: { fileId: string; alt?: string }) => ReturnType;
    };
  }
}

/**
 * Replaces `@tiptap/extension-image` throughout this editor: that
 * extension stores a `src` URL, which the private files bucket has none of
 * (`shared.FileStorage`'s Javadoc: "nothing here returns a public URL").
 * This node stores only `data-file-id` - the same reference `ImageUploadField`
 * hands off as a `fileId` - and the node view below resolves it to a
 * previewable blob via `useObjectUrl`, exactly as `ImageUploadField` does.
 * Serializes to `<img data-file-id="..." alt="...">` with **no `src`
 * attribute at all**, matching the backend `QuizRichText` sanitizer's
 * vocabulary exactly - see its Javadoc for why that absence is the whole
 * point.
 */
export const QuizImage = Node.create({
  name: "quizImage",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      fileId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-file-id"),
        renderHTML: (attributes) => ({ "data-file-id": attributes.fileId }),
      },
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute("alt"),
        renderHTML: (attributes) => (attributes.alt ? { alt: attributes.alt } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-file-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addCommands() {
    return {
      insertQuizImage:
        (options) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { fileId: options.fileId, alt: options.alt ?? null },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuizImageNodeView);
  },
});
