import type { QuestionType, TakeHomeQuizQuestionView } from "@/api/takeHomeQuizzes";

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
}

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
  };
}
