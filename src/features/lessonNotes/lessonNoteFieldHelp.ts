/**
 * What-to-enter guidance for each field on `LessonNoteEditorPage`'s editable form - shown as a
 * `FormField`/`StringListField`/`PresentationStepsField` `description`, above the control. Kept
 * as one editable map, sibling to `lessonNoteStatus.ts`, rather than scattered string literals
 * through the (already large) editor page.
 * <p>
 * Copy is derived field-for-field from `LessonNotePromptBuilder.systemPrompt()`'s per-section
 * instructions (backend `lessonnote.domain`) - the same expectation the AI is held to, so a
 * human-written note and an AI-drafted one are shaped the same way. Keep the two in sync if
 * either changes.
 */
export const LESSON_NOTE_FIELD_HELP = {
  topic: "The week's main curriculum topic, exactly as it appears in the scheme of work.",
  subTopic: "The narrower slice of the topic this particular lesson covers.",
  duration: "How long a single period of this lesson runs.",
  averageAge: "The typical age of learners in this class.",
  entryBehaviour: "What learners already know that this lesson builds on — one or two sentences.",
  objectives:
    "What learners should be able to do by the end of the lesson. One per row, usually 3 to 5.",
  instructionalMaterials:
    "The teaching aids you'll use — charts, textbooks, real objects. One per row, usually 3 to 6.",
  references:
    "The textbooks or curriculum documents this note draws on. One per row; include the title, author, and page where you can.",
  presentation:
    "How the lesson develops, step by step — what you do and what learners do in response. Usually 3 to 5 steps.",
  evaluation:
    "The questions you'll use to check learners understood the lesson. Usually 2 to 4, one per line.",
  conclusion: "How you'll close the lesson — a one or two sentence summary of what was covered.",
  assignment: "The homework you'll set, in one or two sentences.",
} as const;
