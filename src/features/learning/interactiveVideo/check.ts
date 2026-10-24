import type { InteractiveItem } from "@/api/learning";

/**
 * Client-side answer checking for an interactive video's graded items. Practice only - nothing is
 * scored server-side or stored, so the answer key ships with the document and this is the one
 * place it's compared against.
 */

/** A choice question: single-choice needs the one correct option, multiple-choice exactly the set of correct ones. */
export function checkChoice(item: InteractiveItem, selectedIds: readonly string[]): boolean {
  const correct = (item.content.options ?? []).filter((option) => option.correct).map((option) => option.id);
  if (selectedIds.length !== correct.length) {
    return false;
  }
  const selected = new Set(selectedIds);
  return correct.every((id) => selected.has(id));
}

export function checkTrueFalse(item: InteractiveItem, value: boolean): boolean {
  return item.content.answer === value;
}

export type BlankSegment = { kind: "text"; value: string } | { kind: "blank"; answers: string[] };

/**
 * Splits a fill-in-the-blanks text into prose and blanks - H5P's `*answer*` marker syntax, with
 * `/` separating accepted alternatives (`*100/one hundred*`).
 */
export function parseBlanks(text: string | null): BlankSegment[] {
  const segments: BlankSegment[] = [];
  const pattern = /\*([^*]+)\*/g;
  const source = text ?? "";
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > last) {
      segments.push({ kind: "text", value: source.slice(last, match.index) });
    }
    const answers = match[1]
      .split("/")
      .map((answer) => answer.trim())
      .filter((answer) => answer !== "");
    segments.push({ kind: "blank", answers });
    last = match.index + match[0].length;
  }
  if (last < source.length) {
    segments.push({ kind: "text", value: source.slice(last) });
  }
  return segments;
}

function normalizeAnswer(value: string, caseSensitive: boolean): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  return caseSensitive ? collapsed : collapsed.toLowerCase();
}

/** One result per blank, in order - each blank right when it matches any accepted alternative. */
export function checkBlanks(item: InteractiveItem, typed: readonly string[]): boolean[] {
  const caseSensitive = item.content.caseSensitive === true;
  const blanks = parseBlanks(item.content.text).filter(
    (segment): segment is Extract<BlankSegment, { kind: "blank" }> => segment.kind === "blank",
  );
  return blanks.map((blank, index) => {
    const answer = normalizeAnswer(typed[index] ?? "", caseSensitive);
    return answer !== "" && blank.answers.some((accepted) => normalizeAnswer(accepted, caseSensitive) === answer);
  });
}
