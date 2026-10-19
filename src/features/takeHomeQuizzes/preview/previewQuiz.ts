import type { PublicAnswerView, PublicQuestionView, PublicStimulusView } from "@/api/publicTakeHomeQuiz";
import type { QuizReviewQuestion } from "@/features/takeHomeQuizzes/components/QuizReview";
import type { EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";
import type { EditableStimulus } from "@/features/takeHomeQuizzes/editableStimulus";
import { pluginFor } from "@/features/takeHomeQuizzes/interactions/registry";

/**
 * The staff quiz preview's client-side stand-in for the server's attempt: it turns the editor's
 * questions (saved or not) into the answer-free player shape a student receives, and scores a
 * preview run the way backend `AttemptScorer` does. Nothing here is ever sent anywhere - a real
 * attempt is always scored by the server.
 */

export interface ShuffleOptions {
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
}

/** A question the preview can play - the editor's row, keyed by the id its player view carries. */
interface PlayableQuestion {
  id: string;
  source: EditableQuestion;
}

export interface PreviewQuiz {
  questions: PublicQuestionView[];
  /** The passages the played questions link to, as the player receives them. */
  stimuli: PublicStimulusView[];
  /** Interactive questions with no config yet - left out of the preview. */
  skipped: number;
}

function fisherYates<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function questionId(question: EditableQuestion): string {
  return question.id ?? question.key;
}

function playable(questions: EditableQuestion[]): PlayableQuestion[] {
  return questions
    .filter((question) => !pluginFor(question.questionType) || question.interaction !== null)
    .map((source) => ({ id: questionId(source), source }));
}

/**
 * The player views a student would get: no `correct` flag or answer key, an interactive question's
 * own shuffled `toPlayerView`, and the quiz's shuffle settings applied, renumbered 1..n like the
 * server's `TakeHomeQuizAttemptRunner`.
 */
export function toPreviewQuestions(
  questions: EditableQuestion[],
  shuffle: ShuffleOptions,
  random: () => number = Math.random,
  stimuli: EditableStimulus[] = [],
): PreviewQuiz {
  const rows = playable(questions);
  // A passage's questions shuffle as one block, in order inside it - the server's `displayOrder` rule.
  const blocks: PlayableQuestion[][] = [];
  for (const row of rows) {
    const last = blocks[blocks.length - 1];
    const key = row.source.stimulusKey;
    if (key !== null && last && last[0].source.stimulusKey === key) last.push(row);
    else blocks.push([row]);
  }
  const ordered = (shuffle.shuffleQuestions ? fisherYates(blocks, random) : blocks).flat();
  const stimulusIdOf = new Map(stimuli.map((stimulus) => [stimulus.key, stimulus.id ?? stimulus.key]));
  const usedKeys = new Set(rows.map((row) => row.source.stimulusKey).filter((key) => key !== null));
  return {
    skipped: questions.length - rows.length,
    stimuli: stimuli
      .filter((stimulus) => usedKeys.has(stimulus.key))
      .map((stimulus) => ({
        id: stimulus.id ?? stimulus.key,
        kind: stimulus.kind,
        title: stimulus.title.trim() === "" ? null : stimulus.title.trim(),
        body: stimulus.body,
        paragraphLabels: stimulus.kind === "PASSAGE" && stimulus.paragraphLabels,
      })),
    questions: ordered.map(({ id, source }, index) => {
      const plugin = pluginFor(source.questionType);
      const options = source.options.map((option) => ({ id: option.id ?? option.key, label: option.label }));
      const orderedOptions =
        shuffle.shuffleChoices && !plugin ? fisherYates(options, random) : options;
      return {
        id,
        position: index + 1,
        questionType: source.questionType,
        prompt: source.prompt,
        points: Number(source.points) || 0,
        options: plugin ? [] : orderedOptions.map((option, optionIndex) => ({ ...option, position: optionIndex + 1 })),
        playerConfig: plugin ? plugin.toPlayerView(source.interaction) : null,
        stimulusId: source.stimulusKey !== null ? (stimulusIdOf.get(source.stimulusKey) ?? null) : null,
      };
    }),
  };
}

/** The TS twin of backend `AnswerMatchPolicy#normalize`. */
export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, " ").normalize("NFKC").toUpperCase();
}

function fillInTheGapMatches(submitted: string | null, expected: string[]): boolean {
  if (!submitted || submitted.trim() === "") {
    return false;
  }
  const answer = normalizeAnswer(submitted);
  return expected.some((key) => key.trim() !== "" && normalizeAnswer(key) === answer);
}

function sameSet(a: string[], b: string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((id) => right.has(id));
}

export interface PreviewResult {
  /** The passages the reviewed questions link to. */
  stimuli: PublicStimulusView[];
  score: number;
  totalPoints: number;
  questions: QuizReviewQuestion[];
}

/**
 * Scores a preview run like backend `AttemptScorer`: a choice question is all-or-nothing on the
 * exact set of correct options, a fill-in-the-gap question matches any answer key under
 * `normalizeAnswer`, and an interactive question goes through its plugin's scorer. Reviewed in the
 * order the questions were played.
 */
export function scorePreview(
  played: PublicQuestionView[],
  questions: EditableQuestion[],
  answers: Record<string, PublicAnswerView>,
  stimuli: PublicStimulusView[] = [],
): PreviewResult {
  const byId = new Map(playable(questions).map(({ id, source }) => [id, source]));
  let score = 0;
  let totalPoints = 0;
  const reviewed: QuizReviewQuestion[] = [];

  for (const view of played) {
    const source = byId.get(view.id);
    if (!source) {
      continue;
    }
    const answer = answers[view.id];
    const points = view.points;
    const selectedOptionIds = answer?.selectedOptionIds ?? [];
    const textAnswer = answer?.textAnswer ?? null;
    const acceptedAnswers = source.answerKeys.map((key) => key.expectedAnswer).filter((key) => key.trim() !== "");
    const plugin = pluginFor(source.questionType);
    let awarded: number;
    let parts: QuizReviewQuestion["parts"];

    if (plugin) {
      const result = plugin.score(source.interaction, answer?.interaction ?? null, points, source.scoring ?? "PARTIAL");
      awarded = result.awarded;
      parts = result.parts;
    } else if (source.questionType === "FILL_IN_THE_GAP") {
      awarded = fillInTheGapMatches(textAnswer, acceptedAnswers) ? points : 0;
    } else {
      const correctIds = source.options.filter((option) => option.correct).map((option) => option.id ?? option.key);
      awarded = selectedOptionIds.length > 0 && sameSet(selectedOptionIds, correctIds) ? points : 0;
    }

    score += awarded;
    totalPoints += points;
    reviewed.push({
      id: view.id,
      position: view.position,
      questionType: source.questionType,
      prompt: source.prompt,
      points,
      options: plugin
        ? []
        : view.options.map((option) => ({
            id: option.id,
            label: option.label,
            correct: source.options.some((o) => (o.id ?? o.key) === option.id && o.correct),
          })),
      acceptedAnswers,
      selectedOptionIds,
      textAnswer,
      awardedPoints: awarded,
      interaction: plugin ? source.interaction : null,
      response: plugin ? (answer?.interaction ?? null) : null,
      parts,
      stimulusId: view.stimulusId ?? null,
    });
  }

  return { score, totalPoints, questions: reviewed, stimuli };
}
