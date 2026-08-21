import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment } from "react";

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
 * This is the first `dangerouslySetInnerHTML` in the codebase; it stays
 * safe because of that narrow scope plus KaTeX's own `trust: false`
 * (its default), which refuses `\href`/`\url`/`\htmlClass` and every other
 * HTML-emitting command. Neither of those two constraints should be
 * relaxed without re-weighing this component's safety argument.
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

function renderMathHtml(expression: string): string | null {
  try {
    return katex.renderToString(expression, {
      throwOnError: false,
      trust: false,
      strict: "ignore",
      displayMode: false,
    });
  } catch {
    return null;
  }
}

type Segment = { type: "text" | "math"; value: string };

const DELIMITER_PAIRS: Array<[string, string]> = [
  ["\\(", "\\)"],
  ["\\[", "\\]"],
  ["$$", "$$"],
];

/** Splits on the first-found delimiter pair at each position - a plain scan, not a regex, so nested/unbalanced input degrades to plain text rather than misparsing. */
function splitMathSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  let textStart = 0;

  while (cursor < text.length) {
    const match = findNextDelimiter(text, cursor);
    if (!match) {
      break;
    }
    const closeIndex = text.indexOf(match.close, match.index + match.open.length);
    if (closeIndex < 0) {
      cursor = match.index + match.open.length;
      continue;
    }
    if (match.index > textStart) {
      segments.push({ type: "text", value: text.slice(textStart, match.index) });
    }
    const expression = text.slice(match.index + match.open.length, closeIndex);
    segments.push({ type: "math", value: expression });
    cursor = closeIndex + match.close.length;
    textStart = cursor;
  }

  if (textStart < text.length) {
    segments.push({ type: "text", value: text.slice(textStart) });
  }
  return segments;
}

function findNextDelimiter(
  text: string,
  from: number,
): { index: number; open: string; close: string } | null {
  let best: { index: number; open: string; close: string } | null = null;
  for (const [open, close] of DELIMITER_PAIRS) {
    const index = text.indexOf(open, from);
    if (index >= 0 && (best === null || index < best.index)) {
      best = { index, open, close };
    }
  }
  return best;
}
