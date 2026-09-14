/**
 * Splits a plain-text string into alternating prose/maths segments on the
 * first-found delimiter pair at each position - a plain scan, not a regex,
 * so nested/unbalanced input degrades to plain text rather than misparsing.
 * Extracted from `features/lessonNotes/components/MathText.tsx`, the first
 * caller, so `lessonNoteContentToHtml.ts` (Phase 16G's structured-content →
 * document-mode-HTML converter) can reuse the identical delimiter contract
 * rather than a second copy of this scanner.
 */
export type MathSegment = { type: "text" | "math"; value: string };

const DELIMITER_PAIRS: Array<[string, string]> = [
  ["\\(", "\\)"],
  ["\\[", "\\]"],
  ["$$", "$$"],
];

export function splitMathSegments(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
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
