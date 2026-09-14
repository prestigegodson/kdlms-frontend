import type { LessonNoteContentView } from "@/api/lessonNotes";
import { splitMathSegments } from "@/components/richText/mathSegments";

/**
 * Renders a `STRUCTURED` note's eleven fields into the document-mode
 * vocabulary (`lessonnote.domain.LessonNoteRichText`'s tag list) - one
 * `<h3>` heading per non-blank section, a `<ul>` for each of the three list
 * fields, a real `<table>` for the presentation steps, and every inline
 * `\( ... \)` LaTeX run (the AI-generation wire contract's own maths
 * delimiter - see `LessonNotePromptBuilder`) rewritten into an
 * `<span data-type="inline-math" data-latex="...">`, the shape
 * `RichContent`/the backend sanitizer both expect. Two callers: the
 * editor's own "Convert to document" action on a note that already holds
 * structured content, and `AiGenerateSheet`'s "Use this" action when the
 * note is already in document mode (the AI wire contract itself stays
 * plain-text/STRUCTURED regardless of the editor's own mode - see
 * `GenerateLessonNoteService.toContentView`'s Javadoc). Purely client-side:
 * the server sanitizes whatever body ends up saved regardless of how it was
 * built, so this needs no endpoint of its own.
 */
export function lessonNoteContentToHtml(content: LessonNoteContentView): string {
  const blocks: string[] = [];

  pushField(blocks, "Sub-topic", content.subTopic);
  pushField(blocks, "Duration", content.duration);
  pushField(blocks, "Average age", content.averageAge);
  pushField(blocks, "Entry behaviour", content.entryBehaviour);
  pushList(blocks, "Behavioural objectives", content.objectives);
  pushList(blocks, "Instructional materials", content.instructionalMaterials);
  pushList(blocks, "References", content.references);
  pushPresentation(blocks, content.presentation);
  pushField(blocks, "Evaluation", content.evaluation);
  pushField(blocks, "Conclusion", content.conclusion);
  pushField(blocks, "Assignment", content.assignment);

  return blocks.length > 0 ? blocks.join("") : "<p></p>";
}

function pushField(blocks: string[], heading: string, value: string | null): void {
  if (!value || value.trim() === "") {
    return;
  }
  blocks.push(`<h3>${escapeHtml(heading)}</h3><p>${textToInlineHtml(value)}</p>`);
}

function pushList(blocks: string[], heading: string, values: string[]): void {
  const nonBlank = values.filter((value) => value.trim() !== "");
  if (nonBlank.length === 0) {
    return;
  }
  const items = nonBlank.map((value) => `<li>${textToInlineHtml(value)}</li>`).join("");
  blocks.push(`<h3>${escapeHtml(heading)}</h3><ul>${items}</ul>`);
}

function pushPresentation(blocks: string[], steps: LessonNoteContentView["presentation"]): void {
  const nonBlank = steps.filter(
    (step) => step.label.trim() !== "" || step.teacherActivity.trim() !== "" || step.learnerActivity.trim() !== "",
  );
  if (nonBlank.length === 0) {
    return;
  }
  const rows = nonBlank
    .map(
      (step, index) =>
        `<tr><td>${textToInlineHtml(step.label) || escapeHtml(`Step ${index + 1}`)}</td>` +
        `<td>${textToInlineHtml(step.teacherActivity)}</td>` +
        `<td>${textToInlineHtml(step.learnerActivity)}</td></tr>`,
    )
    .join("");
  blocks.push(
    "<h3>Presentation</h3><table><thead><tr><th>Step</th><th>Teacher</th><th>Learners</th></tr></thead>" +
      `<tbody>${rows}</tbody></table>`,
  );
}

/** A plain-text field's inline LaTeX (`\( ... \)`) becomes a math span; everything else is HTML-escaped. */
function textToInlineHtml(text: string): string {
  return splitMathSegments(text)
    .map((segment) =>
      segment.type === "math"
        ? `<span data-type="inline-math" data-latex="${escapeAttribute(segment.value)}"></span>`
        : escapeHtml(segment.value),
    )
    .join("");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
