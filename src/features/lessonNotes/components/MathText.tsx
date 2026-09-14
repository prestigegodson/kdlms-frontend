import { Fragment } from "react";
import { renderMathHtml } from "@/components/richText/katexHtml";
import { splitMathSegments } from "@/components/richText/mathSegments";

/**
 * Renders a lesson-note prose string that may contain inline LaTeX, per
 * `LessonNotePromptBuilder`'s system-prompt contract on the backend: maths
 * is delimited with `\( ... \)`, never `\[ ... \]`/`$...$`/`$$...$$`. Those
 * two are still recognized here defensively, since a row saved before this
 * contract existed may still hold them, but the prompt no longer asks for
 * them.
 * <p>
 * Only the matched maths substrings are ever handed to KaTeX -
 * surrounding prose always renders as a plain React text node, never HTML.
 * Rendering itself is `@/components/richText/katexHtml`'s `renderMathHtml` -
 * see its doc comment for the `dangerouslySetInnerHTML` safety argument this
 * component was the first to rely on. The delimiter scan itself
 * (`splitMathSegments`) has moved to `@/components/richText/mathSegments` so
 * `lessonNoteContentToHtml.ts` (Phase 16G) can reuse the identical contract
 * when converting a structured note's plain-text prose into document-mode
 * HTML - this component's own behaviour is unchanged.
 * <p>
 * A malformed expression falls back to its raw source text rather than
 * throwing or rendering blank, so a model slip degrades to today's
 * (pre-rendering) behaviour instead of breaking the page.
 */
export function MathText({ text }: { text: string }) {
  const segments = splitMathSegments(text);
  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {segment.type === "text" ? segment.value : <MathSpan expression={segment.value} />}
        </Fragment>
      ))}
    </>
  );
}

function MathSpan({ expression }: { expression: string }) {
  const html = renderMathHtml(expression);
  if (html === null) {
    return <>{expression}</>;
  }
  // Safe per the component-level note above: `html` is KaTeX's own output for
  // this one expression substring, rendered with `trust: false`.
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
