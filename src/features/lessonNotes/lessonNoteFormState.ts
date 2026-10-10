import type { LessonNoteContentView } from "@/api/lessonNotes";
import { richTextIsBlank } from "@/components/richText/richTextIsBlank";

/**
 * Form-state helpers shared by every lesson-note editor - the school week editor
 * (`LessonNoteEditorPage`) and a creator's class-note editor (`CreatorLessonNoteEditorPage`,
 * creators Phase C12) - so both track unsaved changes and offer "Convert to document" identically.
 */

export const EMPTY_CONTENT: LessonNoteContentView = {
  mode: "UPLOAD",
  body: "",
  subTopic: "",
  duration: "",
  averageAge: "",
  objectives: [],
  entryBehaviour: "",
  instructionalMaterials: [],
  references: [],
  presentation: [],
  evaluation: "",
  conclusion: "",
  assignment: "",
};

/**
 * Normalizes a content snapshot for dirty-tracking and comparison -
 * `richTextIsBlank` maps every shape TipTap's empty document can take
 * (`""`, `"<p></p>"`, ...) to the same `""`, so loading a saved
 * `STRUCTURED` note (whose `body` is always empty) or freshly switching to
 * `DOCUMENT` mode never reads as a spurious unsaved change.
 */
export function normalizeForCompare(topic: string, content: LessonNoteContentView) {
  return { topic, content: { ...content, body: richTextIsBlank(content.body) ? "" : content.body } };
}

/** `true` once any structured field carries real content - the "Convert to document" prompt's own gate, so it never offers to convert nothing. */
export function structuredHasContent(content: LessonNoteContentView): boolean {
  return Boolean(
    content.subTopic?.trim() ||
      content.duration?.trim() ||
      content.averageAge?.trim() ||
      content.entryBehaviour?.trim() ||
      content.evaluation?.trim() ||
      content.conclusion?.trim() ||
      content.assignment?.trim() ||
      content.objectives.some((value) => value.trim() !== "") ||
      content.instructionalMaterials.some((value) => value.trim() !== "") ||
      content.references.some((value) => value.trim() !== "") ||
      content.presentation.some(
        (step) => step.label.trim() !== "" || step.teacherActivity.trim() !== "" || step.learnerActivity.trim() !== "",
      ),
  );
}

/** Drops the blank rows a structured form leaves behind (an empty objective, an untouched step) before saving. */
export function cleanContent(content: LessonNoteContentView): LessonNoteContentView {
  return {
    ...content,
    objectives: content.objectives.filter((value) => value.trim() !== ""),
    instructionalMaterials: content.instructionalMaterials.filter((value) => value.trim() !== ""),
    references: content.references.filter((value) => value.trim() !== ""),
    presentation: content.presentation.filter(
      (step) => step.label.trim() !== "" || step.teacherActivity.trim() !== "" || step.learnerActivity.trim() !== "",
    ),
  };
}
