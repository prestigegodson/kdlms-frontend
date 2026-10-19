import type {
  InteractionConfig,
  QuestionCommand,
  QuestionType,
  ScoringMode,
  TakeHomeQuizQuestionView,
} from "@/api/takeHomeQuizzes";

/**
 * `QuestionEditor`'s local, keyed editing shape for one question - split
 * into its own module, sibling to `takeHomeQuizFieldHelp.ts`/
 * `takeHomeQuizStatus.ts`, so `QuestionEditor.tsx` exports components only
 * (the `lessonNoteFieldHelp.ts`/`lessonNoteStatus.ts` precedent, which
 * keeps Fast Refresh from warning about a file mixing components and
 * plain helpers).
 */
export interface EditableOption {
  /** React key - the server id for an existing option, or a generated local uid for one added this session. */
  key: string;
  /** `null` means this option was added this session and has no server id yet - sent as-is so the backend mints one. */
  id: string | null;
  label: string;
  correct: boolean;
}

export interface EditableAnswerKey {
  key: string;
  id: string | null;
  expectedAnswer: string;
}

export interface EditableQuestion {
  key: string;
  id: string | null;
  questionType: QuestionType;
  prompt: string;
  /** Kept as a string while editing so an empty/partial field doesn't fight the number input; parsed on save. */
  points: string;
  options: EditableOption[];
  answerKeys: EditableAnswerKey[];
  /** Staff-only topic tags - lower-cased, at most `MAX_QUESTION_TAGS`. */
  tags: string[];
  /** An interactive question's config (its plugin's own shape); `null` for the original three types. */
  interaction: InteractionConfig | null;
  /** `null` takes the type's default - `PARTIAL` for an interactive type. */
  scoring: ScoringMode | null;
  /** The `EditableStimulus.key` of the passage this question belongs to - `null` for a standalone question. */
  stimulusKey: string | null;
}

/** Every question type's name - the original three and each interactive plugin's (interactions/registry.ts). */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTI_CHOICE: "Multiple choice",
  FILL_IN_THE_GAP: "Fill in the gap",
  SEQUENCE: "Sequence",
  CATEGORIZE: "Categorize",
  MATCHING: "Matching",
  DIAGRAM_LABEL: "Label the diagram",
  HOTSPOT: "Hotspot",
};

export const MAX_QUESTION_TAGS = 5;
export const MAX_QUESTION_TAG_LENGTH = 40;

/** A freshly authored question with two blank choice options - the default shape when adding a row. */
export function blankQuestion(): EditableQuestion {
  return {
    key: crypto.randomUUID(),
    id: null,
    questionType: "SINGLE_CHOICE",
    prompt: "",
    points: "1",
    options: [
      { key: crypto.randomUUID(), id: null, label: "", correct: false },
      { key: crypto.randomUUID(), id: null, label: "", correct: false },
    ],
    answerKeys: [],
    tags: [],
    interaction: null,
    scoring: null,
    stimulusKey: null,
  };
}

/** Converts a saved `TakeHomeQuizQuestionView` into this editor's local, keyed shape. */
export function toEditableQuestion(question: TakeHomeQuizQuestionView): EditableQuestion {
  return {
    key: question.id,
    id: question.id,
    questionType: question.questionType,
    prompt: question.prompt,
    points: String(question.points),
    options: question.options.map((option) => ({
      key: option.id,
      id: option.id,
      label: option.label,
      correct: option.correct,
    })),
    answerKeys: question.answerKeys.map((key) => ({ key: key.id, id: key.id, expectedAnswer: key.expectedAnswer })),
    tags: question.tags ?? [],
    interaction: question.interaction ?? null,
    scoring: question.interaction ? (question.scoring ?? null) : null,
    // A saved stimulus's key is its id (`toEditableStimulus`), so the link survives the round trip.
    stimulusKey: question.stimulusId ?? null,
  };
}

/** Converts a not-yet-saved question command (a bulk import's output) into this editor's local, keyed shape. */
export function fromQuestionCommand(question: QuestionCommand): EditableQuestion {
  return {
    key: crypto.randomUUID(),
    id: null,
    questionType: question.questionType,
    prompt: question.prompt,
    points: String(question.points),
    options: question.options.map((option) => ({
      key: crypto.randomUUID(),
      id: null,
      label: option.label,
      correct: option.correct,
    })),
    answerKeys: question.answerKeys.map((key) => ({
      key: crypto.randomUUID(),
      id: null,
      expectedAnswer: key.expectedAnswer,
    })),
    tags: question.tags ?? [],
    interaction: question.interaction ?? null,
    scoring: question.interaction ? (question.scoring ?? null) : null,
    // An import or a bank copy is always a standalone question.
    stimulusKey: null,
  };
}

/** This editor's shape back as a save command - the mapping both editor pages send to `PUT .../questions`. */
export function toQuestionCommand(question: EditableQuestion): QuestionCommand {
  return {
    id: question.id,
    questionType: question.questionType,
    prompt: question.prompt,
    points: Number(question.points) || 0,
    options: question.options.map((option) => ({ id: option.id, label: option.label, correct: option.correct })),
    answerKeys: question.answerKeys
      .filter((key) => key.expectedAnswer.trim() !== "")
      .map((key) => ({ id: key.id, expectedAnswer: key.expectedAnswer })),
    tags: question.tags,
    interaction: question.interaction,
    scoring: question.interaction ? question.scoring : null,
  };
}

/** True for a row added this session and never filled in - what an import replaces rather than appends after. */
export function isUntouchedQuestion(question: EditableQuestion): boolean {
  return (
    question.id === null &&
    question.interaction === null &&
    isBlankRichText(question.prompt) &&
    question.options.every((option) => isBlankRichText(option.label)) &&
    question.answerKeys.every((key) => key.expectedAnswer.trim() === "")
  );
}

/** No visible text, and no embedded image or maths (which carry no text of their own). */
function isBlankRichText(html: string): boolean {
  return !/data-(file-id|latex)=/.test(html) && html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}
