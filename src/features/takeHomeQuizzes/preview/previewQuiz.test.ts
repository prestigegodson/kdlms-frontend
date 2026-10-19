import { describe, expect, it } from "vitest";
import type { EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";
import { normalizeAnswer, scorePreview, toPreviewQuestions } from "@/features/takeHomeQuizzes/preview/previewQuiz";

function choice(key: string, type: "SINGLE_CHOICE" | "MULTI_CHOICE", correct: boolean[]): EditableQuestion {
  return {
    key,
    id: null,
    questionType: type,
    prompt: `<p>${key}</p>`,
    points: "2",
    options: correct.map((isCorrect, index) => ({ key: `${key}-o${index}`, id: null, label: `<p>${index}</p>`, correct: isCorrect })),
    answerKeys: [],
    tags: [],
    interaction: null,
    scoring: null,
    stimulusKey: null,
  };
}

function gap(key: string, expected: string[]): EditableQuestion {
  return {
    ...choice(key, "SINGLE_CHOICE", []),
    questionType: "FILL_IN_THE_GAP",
    options: [],
    answerKeys: expected.map((expectedAnswer, index) => ({ key: `${key}-k${index}`, id: null, expectedAnswer })),
  };
}

const sequence: EditableQuestion = {
  ...choice("seq", "SINGLE_CHOICE", []),
  questionType: "SEQUENCE",
  options: [],
  interaction: {
    schemaVersion: 1,
    presentation: "LIST",
    items: [
      { id: "a", html: "<p>A</p>" },
      { id: "b", html: "<p>B</p>" },
      { id: "c", html: "<p>C</p>" },
    ],
  },
  scoring: "ALL_OR_NOTHING",
};

const NO_SHUFFLE = { shuffleQuestions: false, shuffleChoices: false };

describe("toPreviewQuestions", () => {
  it("never carries an answer into the player view", () => {
    const { questions } = toPreviewQuestions([choice("q1", "SINGLE_CHOICE", [true, false]), gap("q2", ["Lagos"])], NO_SHUFFLE);
    expect(JSON.stringify(questions)).not.toContain("correct");
    expect(JSON.stringify(questions)).not.toContain("Lagos");
    expect(questions.map((q) => q.position)).toEqual([1, 2]);
    expect(questions[0].options.map((o) => o.id)).toEqual(["q1-o0", "q1-o1"]);
  });

  it("shuffles the interactive player view and skips an interactive question with no config", () => {
    const unfinished = { ...sequence, key: "empty", interaction: null };
    const { questions, skipped } = toPreviewQuestions([sequence, unfinished], NO_SHUFFLE);
    expect(skipped).toBe(1);
    expect(questions).toHaveLength(1);
    const items = (questions[0].playerConfig as { items: { id: string }[] }).items.map((item) => item.id);
    expect(items).not.toEqual(["a", "b", "c"]);
  });

  it("applies the quiz's shuffle settings and renumbers", () => {
    // Always picking index 0 reverses a two-item list.
    const reverse = () => 0;
    const { questions } = toPreviewQuestions(
      [choice("q1", "SINGLE_CHOICE", [true, false]), choice("q2", "SINGLE_CHOICE", [true, false])],
      { shuffleQuestions: true, shuffleChoices: true },
      reverse,
    );
    expect(questions.map((q) => q.id)).toEqual(["q2", "q1"]);
    expect(questions.map((q) => q.position)).toEqual([1, 2]);
    expect(questions[0].options.map((o) => o.position)).toEqual([1, 2]);
  });
});

describe("scorePreview", () => {
  it("scores choice questions all-or-nothing on the exact correct set", () => {
    const questions = [choice("s", "SINGLE_CHOICE", [false, true]), choice("m", "MULTI_CHOICE", [true, true, false])];
    const { questions: played } = toPreviewQuestions(questions, NO_SHUFFLE);
    const result = scorePreview(played, questions, {
      s: { selectedOptionIds: ["s-o1"], textAnswer: null },
      m: { selectedOptionIds: ["m-o0"], textAnswer: null },
    });
    expect(result.score).toBe(2);
    expect(result.totalPoints).toBe(4);
    expect(result.questions[1].options.map((o) => o.correct)).toEqual([true, true, false]);
  });

  it("matches a fill-in-the-gap answer like AnswerMatchPolicy", () => {
    const questions = [gap("g", ["Port  Harcourt"])];
    const { questions: played } = toPreviewQuestions(questions, NO_SHUFFLE);
    expect(scorePreview(played, questions, { g: { selectedOptionIds: [], textAnswer: "  port harcourt " } }).score).toBe(2);
    expect(scorePreview(played, questions, { g: { selectedOptionIds: [], textAnswer: "Port" } }).score).toBe(0);
    expect(normalizeAnswer("ｆｕｌｌ")).toBe("FULL");
  });

  it("scores an interactive question through its plugin", () => {
    const { questions: played } = toPreviewQuestions([sequence], NO_SHUFFLE);
    const right = scorePreview(played, [sequence], {
      seq: { selectedOptionIds: [], textAnswer: null, interaction: { order: ["a", "b", "c"] } },
    });
    expect(right.score).toBe(2);
    expect(right.questions[0].parts?.length).toBeGreaterThan(0);
    const wrong = scorePreview(played, [sequence], {
      seq: { selectedOptionIds: [], textAnswer: null, interaction: { order: ["b", "a", "c"] } },
    });
    expect(wrong.score).toBe(0);
  });
});
