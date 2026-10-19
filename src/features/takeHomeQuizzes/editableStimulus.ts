import type {
  QuestionCommand,
  StimulusCommand,
  StimulusKind,
  TakeHomeQuizStimulusView,
} from "@/api/takeHomeQuizzes";
import { blankQuestion, type EditableQuestion, toQuestionCommand } from "@/features/takeHomeQuizzes/editableQuestion";

/**
 * The editor's shape for a shared passage or group instruction (quiz-module.md Phase 20L) and the
 * pure list operations `QuestionEditor` runs on the question list around it. Questions link to a
 * stimulus by `EditableQuestion.stimulusKey`; every operation here keeps a stimulus's questions
 * contiguous - the same rule the backend's `TakeHomeQuiz#replaceContent` enforces - so the editor
 * can never build a save the server would refuse for a split passage.
 */
export interface EditableStimulus {
  /** React key and link target - the server id for a saved stimulus, a local uid for a new one. */
  key: string;
  /** `null` until saved - sent as-is so the backend mints one. */
  id: string | null;
  kind: StimulusKind;
  title: string;
  body: string;
  paragraphLabels: boolean;
}

export const STIMULUS_KIND_LABELS: Record<StimulusKind, string> = {
  PASSAGE: "Passage",
  INSTRUCTION: "Instruction",
};

export function blankStimulus(kind: StimulusKind = "PASSAGE"): EditableStimulus {
  return { key: crypto.randomUUID(), id: null, kind, title: "", body: "", paragraphLabels: false };
}

export function toEditableStimulus(view: TakeHomeQuizStimulusView): EditableStimulus {
  return {
    key: view.id,
    id: view.id,
    kind: view.kind,
    title: view.title ?? "",
    body: view.body,
    paragraphLabels: view.paragraphLabels,
  };
}

/** The editor's stimuli and questions as one `PUT .../questions` body - each link sent as an index into `stimuli`. */
export function toContentCommands(
  stimuli: EditableStimulus[],
  questions: EditableQuestion[],
): { stimuli: StimulusCommand[]; questions: QuestionCommand[] } {
  const indexByKey = new Map(stimuli.map((stimulus, index) => [stimulus.key, index]));
  return {
    stimuli: stimuli.map((stimulus) => ({
      id: stimulus.id,
      kind: stimulus.kind,
      title: stimulus.title.trim() === "" ? null : stimulus.title.trim(),
      body: stimulus.body,
      paragraphLabels: stimulus.kind === "PASSAGE" && stimulus.paragraphLabels,
    })),
    questions: questions.map((question) => ({
      ...toQuestionCommand(question),
      stimulusIndex: question.stimulusKey !== null ? (indexByKey.get(question.stimulusKey) ?? null) : null,
    })),
  };
}

/** One editor section: a stimulus with its (possibly empty) run of questions, or one standalone question. */
export type EditorSection =
  | { kind: "stimulus"; stimulus: EditableStimulus; questions: { question: EditableQuestion; index: number }[] }
  | { kind: "question"; question: EditableQuestion; index: number };

/**
 * `questions` as editor sections in list order - each stimulus's contiguous run grouped under it -
 * then every stimulus no question uses yet, so a passage whose questions were all removed stays
 * editable. `index` is each question's position in `questions`.
 */
export function editorSections(stimuli: EditableStimulus[], questions: EditableQuestion[]): EditorSection[] {
  const byKey = new Map(stimuli.map((stimulus) => [stimulus.key, stimulus]));
  const sections: EditorSection[] = [];
  const used = new Set<string>();
  questions.forEach((question, index) => {
    const stimulus = question.stimulusKey !== null ? byKey.get(question.stimulusKey) : undefined;
    if (!stimulus) {
      sections.push({ kind: "question", question, index });
      return;
    }
    const last = sections[sections.length - 1];
    if (last?.kind === "stimulus" && last.stimulus.key === stimulus.key) {
      last.questions.push({ question, index });
    } else {
      sections.push({ kind: "stimulus", stimulus, questions: [{ question, index }] });
      used.add(stimulus.key);
    }
  });
  for (const stimulus of stimuli) {
    if (!used.has(stimulus.key)) sections.push({ kind: "stimulus", stimulus, questions: [] });
  }
  return sections;
}

/** The [start, end) range of `questions` the run linked to `stimulusKey` occupies - empty at the end when unused. */
function runOf(questions: EditableQuestion[], stimulusKey: string): [number, number] {
  const start = questions.findIndex((question) => question.stimulusKey === stimulusKey);
  if (start === -1) return [questions.length, questions.length];
  let end = start;
  while (end < questions.length && questions[end].stimulusKey === stimulusKey) end++;
  return [start, end];
}

/** The [start, end) block `index` belongs to - its stimulus's whole run, or just itself when standalone. */
function blockAt(questions: EditableQuestion[], index: number): [number, number] {
  const key = questions[index].stimulusKey;
  return key === null ? [index, index + 1] : runOf(questions, key);
}

/**
 * Moves one question a step up (-1) or down (+1). Inside a passage it swaps with its neighbour and
 * never leaves the passage; a standalone question steps over a whole neighbouring passage at once.
 */
export function moveQuestion(questions: EditableQuestion[], index: number, direction: -1 | 1): EditableQuestion[] {
  const question = questions[index];
  const neighbour = index + direction;
  if (neighbour < 0 || neighbour >= questions.length) return questions;
  if (question.stimulusKey !== null) {
    if (questions[neighbour].stimulusKey !== question.stimulusKey) return questions;
    const next = [...questions];
    [next[index], next[neighbour]] = [next[neighbour], next[index]];
    return next;
  }
  const [start, end] = blockAt(questions, neighbour);
  const rest = questions.filter((_, i) => i !== index);
  const insertAt = direction === -1 ? start : end - 1;
  rest.splice(insertAt, 0, question);
  return rest;
}

/** Whether `moveQuestion(questions, index, direction)` would move anything - drives the arrows' disabled state. */
export function canMoveQuestion(questions: EditableQuestion[], index: number, direction: -1 | 1): boolean {
  const neighbour = index + direction;
  if (neighbour < 0 || neighbour >= questions.length) return false;
  const key = questions[index].stimulusKey;
  return key === null || questions[neighbour].stimulusKey === key;
}

/** Moves a stimulus's whole run one block up (-1) or down (+1), stepping over a whole neighbouring passage. */
export function moveStimulusRun(
  questions: EditableQuestion[],
  stimulusKey: string,
  direction: -1 | 1,
): EditableQuestion[] {
  const [start, end] = runOf(questions, stimulusKey);
  if (start === end) return questions;
  const neighbour = direction === -1 ? start - 1 : end;
  if (neighbour < 0 || neighbour >= questions.length) return questions;
  const [nStart, nEnd] = blockAt(questions, neighbour);
  const run = questions.slice(start, end);
  const other = questions.slice(nStart, nEnd);
  return direction === -1
    ? [...questions.slice(0, nStart), ...run, ...other, ...questions.slice(end)]
    : [...questions.slice(0, start), ...other, ...run, ...questions.slice(nEnd)];
}

/**
 * Re-links the question at `index` to `stimulusKey` (`null` = standalone). It joins the end of the
 * target passage's run (or the end of the list when that passage has no questions yet); unlinked,
 * it lands just after the run it left, so it stays where the teacher was looking.
 */
export function relinkQuestion(
  questions: EditableQuestion[],
  index: number,
  stimulusKey: string | null,
): EditableQuestion[] {
  const question = questions[index];
  if (question.stimulusKey === stimulusKey) return questions;
  const moved = { ...question, stimulusKey };
  const rest = questions.filter((_, i) => i !== index);
  if (stimulusKey === null) {
    // The run it left - empty when it was the run's only question, which then simply stays put.
    const [start, end] = runOf(rest, question.stimulusKey as string);
    rest.splice(start === end ? index : end, 0, moved);
    return rest;
  }
  const [, end] = runOf(rest, stimulusKey);
  rest.splice(end, 0, moved);
  return rest;
}

/** Appends a blank question to the end of `stimulusKey`'s run. */
export function addQuestionToStimulus(questions: EditableQuestion[], stimulusKey: string): EditableQuestion[] {
  const [, end] = runOf(questions, stimulusKey);
  const next = [...questions];
  next.splice(end, 0, { ...blankQuestion(), stimulusKey });
  return next;
}

/**
 * Removes a stimulus. `keepQuestions` turns its questions into standalone ones in place; otherwise
 * they go with it.
 */
export function removeStimulus(
  stimuli: EditableStimulus[],
  questions: EditableQuestion[],
  stimulusKey: string,
  keepQuestions: boolean,
): { stimuli: EditableStimulus[]; questions: EditableQuestion[] } {
  return {
    stimuli: stimuli.filter((stimulus) => stimulus.key !== stimulusKey),
    questions: keepQuestions
      ? questions.map((question) => (question.stimulusKey === stimulusKey ? { ...question, stimulusKey: null } : question))
      : questions.filter((question) => question.stimulusKey !== stimulusKey),
  };
}

/** "Questions 3-7" - the display range of a run of 1-based positions; "Question 3" for a single one. */
export function questionRangeLabel(first: number, last: number): string {
  return first === last ? `Question ${first}` : `Questions ${first}–${last}`;
}
