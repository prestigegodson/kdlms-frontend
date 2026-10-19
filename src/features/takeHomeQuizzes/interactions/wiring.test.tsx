import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizAttemptView } from "@/api/publicTakeHomeQuiz";
import { QuestionEditor } from "@/features/takeHomeQuizzes/components/QuestionEditor";
import { blankQuestion, type EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";
import { QuizRunner } from "@/features/takeHomeQuizzes/runner/QuizRunner";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";
import { pluginFor } from "@/features/takeHomeQuizzes/interactions/registry";
import { useFeatureStore } from "@/stores/featureStore";

beforeAll(() => {
  document.elementFromPoint = () => null;
  Range.prototype.getBoundingClientRect = () =>
    ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
  Range.prototype.getClientRects = () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
});

beforeEach(() => {
  useFeatureStore.setState({ interactiveQuestions: true });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  useFeatureStore.getState().reset();
});

function EditorHarness({ onQuestions }: { onQuestions(questions: EditableQuestion[]): void }) {
  const [questions, setQuestions] = useState<EditableQuestion[]>(() => [blankQuestion()]);
  return (
    <QuestionEditor
      questions={questions}
      onChange={(next) => {
        setQuestions(next);
        onQuestions(next);
      }}
    />
  );
}

describe("QuestionEditor with interactive types", () => {
  it("switching to an interactive type seeds its config and shows its own author", async () => {
    let latest: EditableQuestion[] = [];
    render(<EditorHarness onQuestions={(next) => (latest = next)} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Question type"), "MATCHING");

    expect(latest[0].questionType).toBe("MATCHING");
    expect(latest[0].scoring).toBe("PARTIAL");
    expect(latest[0].options).toEqual([]);
    expect(latest[0].interaction).toMatchObject({ schemaVersion: 1, reuseRights: false });
    expect(await screen.findByRole("button", { name: "Add a distractor answer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try question 1" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Scoring"), "ALL_OR_NOTHING");
    expect(latest[0].scoring).toBe("ALL_OR_NOTHING");

    await user.selectOptions(screen.getByLabelText("Question type"), "SINGLE_CHOICE");
    expect(latest[0].interaction).toBeNull();
    expect(latest[0].scoring).toBeNull();
    expect(latest[0].options).toHaveLength(2);
  });
});

describe("QuestionEditor without the interactive-questions add-on", () => {
  it("offers only the original types, but keeps a stored interactive question's own type", () => {
    useFeatureStore.setState({ interactiveQuestions: false });
    const stored: EditableQuestion = {
      ...blankQuestion(),
      questionType: "SEQUENCE",
      options: [],
      interaction: pluginFor("SEQUENCE")!.blank(),
      scoring: "PARTIAL",
    };
    render(<QuestionEditor questions={[blankQuestion(), stored]} onChange={() => {}} />);

    const [fresh, kept] = screen.getAllByLabelText("Question type");
    const values = (select: HTMLElement) =>
      Array.from((select as HTMLSelectElement).options).map((option) => option.value);
    expect(values(fresh)).toEqual(["SINGLE_CHOICE", "MULTI_CHOICE", "FILL_IN_THE_GAP"]);
    expect(values(kept)).toEqual(["SINGLE_CHOICE", "MULTI_CHOICE", "FILL_IN_THE_GAP", "SEQUENCE"]);
  });
});

describe("QuestionEditor with image-based types", () => {
  it("switching to a hotspot seeds an empty image config and offers the upload", async () => {
    let latest: EditableQuestion[] = [];
    render(<EditorHarness onQuestions={(next) => (latest = next)} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Question type"), "HOTSPOT");

    expect(latest[0].interaction).toMatchObject({ schemaVersion: 1, imageFileId: null, maxPins: 1, regions: [] });
    expect(await screen.findByRole("button", { name: "Upload image" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Question type"), "DIAGRAM_LABEL");
    expect(latest[0].interaction).toMatchObject({ imageFileId: null, zones: [], reuseLabels: false });
    expect(await screen.findByRole("button", { name: "Add a label" })).toBeInTheDocument();
  });
});

const attempt: QuizAttemptView = {
  questions: [
    {
      id: "q1",
      position: 1,
      questionType: "SEQUENCE",
      prompt: "<p>Order them</p>",
      points: 3,
      options: [],
      playerConfig: {
        presentation: "LIST",
        items: [
          { id: "b", html: "<p>Two</p>" },
          { id: "a", html: "<p>One</p>" },
          { id: "c", html: "<p>Three</p>" },
        ],
      },
    },
  ],
  answers: {},
  deadlineAt: null,
  serverTime: new Date().toISOString(),
};

describe("QuizRunner with an interactive question", () => {
  it("autosaves the plugin's answer tagged with its question type, and counts it as answered", async () => {
    vi.useFakeTimers();
    const saveAnswers = vi.fn<QuizTransport["saveAnswers"]>().mockResolvedValue(attempt);
    const transport: QuizTransport = {
      bufferKey: "wiring-test",
      saveAnswers,
      submit: vi.fn(),
      renderQuestionImage: () => null,
    };
    render(<QuizRunner initialAttempt={attempt} transport={transport} onSubmitted={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Move One up" }));
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(saveAnswers).toHaveBeenCalledWith([
      {
        questionId: "q1",
        selectedOptionIds: [],
        textAnswer: null,
        interaction: { type: "SEQUENCE", response: { order: ["a", "b", "c"] } },
      },
    ]);
  });
});

describe("QuizRunner submitting right after a sequence move on the last question", () => {
  it("sends the moved order with the submit itself, without waiting for the autosave", async () => {
    vi.useRealTimers();
    const calls: string[] = [];
    const saveAnswers = vi.fn<QuizTransport["saveAnswers"]>(async () => {
      calls.push("save");
      return attempt;
    });
    const submit = vi.fn<QuizTransport["submit"]>(async () => {
      calls.push("submit");
      return { alreadySubmitted: false, revealResults: false, serverTime: "" };
    });
    const onSubmitted = vi.fn();
    const transport: QuizTransport = {
      bufferKey: `wiring-submit-${crypto.randomUUID()}`,
      saveAnswers,
      submit,
      renderQuestionImage: () => null,
    };
    render(<QuizRunner initialAttempt={attempt} transport={transport} onSubmitted={onSubmitted} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Move One up" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit quiz" }));
    const dialog = await screen.findByRole("dialog", { name: "Submit quiz?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit quiz" }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    // No separate pre-submit save - the server's autosave throttle could skip it (and lose the move).
    expect(calls).toEqual(["submit"]);
    expect(submit).toHaveBeenLastCalledWith([
      expect.objectContaining({
        questionId: "q1",
        interaction: { type: "SEQUENCE", response: { order: ["a", "b", "c"] } },
      }),
    ]);
  });
});
