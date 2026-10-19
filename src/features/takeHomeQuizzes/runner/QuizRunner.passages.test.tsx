import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizAttemptView } from "@/api/publicTakeHomeQuiz";
import { QuizRunner } from "@/features/takeHomeQuizzes/runner/QuizRunner";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";

function choice(id: string, position: number, stimulusId: string | null) {
  return {
    id,
    position,
    questionType: "SINGLE_CHOICE" as const,
    prompt: `<p>Question ${id}</p>`,
    points: 1,
    options: [
      { id: `${id}-a`, position: 1, label: "True" },
      { id: `${id}-b`, position: 2, label: "False" },
    ],
    stimulusId,
  };
}

const attempt: QuizAttemptView = {
  questions: [choice("q1", 1, null), choice("q2", 2, "bee"), choice("q3", 3, "bee"), choice("q4", 4, "how")],
  answers: {},
  deadlineAt: null,
  serverTime: "2026-01-01T00:00:00Z",
  stimuli: [
    { id: "bee", kind: "PASSAGE", title: "The Bee", body: "<p>Bees dance.</p><p>They make honey.</p>", paragraphLabels: true },
    { id: "how", kind: "INSTRUCTION", title: null, body: "<p>Choose TRUE or FALSE.</p>", paragraphLabels: false },
  ],
};

function transport(): QuizTransport {
  return {
    bufferKey: `test-${crypto.randomUUID()}`,
    saveAnswers: vi.fn(async () => attempt),
    submit: vi.fn(async () => ({ alreadySubmitted: false, revealResults: false, serverTime: "" })),
    renderQuestionImage: () => null,
  };
}

function renderRunner() {
  render(<QuizRunner initialAttempt={attempt} transport={transport()} onSubmitted={vi.fn()} onError={vi.fn()} />);
}

describe("QuizRunner passages (Phase 20L)", () => {
  beforeEach(() => localStorage.clear());

  it("shows no passage for a standalone question", () => {
    renderRunner();
    expect(screen.queryByRole("region", { name: /^The Bee/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Passage" })).not.toBeInTheDocument();
  });

  it("opens a passage on first reaching it, with its range and lettered paragraphs, beside the question", async () => {
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: /^Next/ }));

    const passage = screen.getByRole("region", { name: "The Bee, Questions 2–3" });
    expect(within(passage).getByRole("button", { name: /^The Bee/ })).toHaveAttribute("aria-expanded", "true");
    expect(within(passage).getByText("They make honey.")).toBeVisible();
    expect(passage.querySelectorAll("[data-paragraph-label]")).toHaveLength(2);
    expect(screen.getByTestId("question-layout").className).toContain("lg:grid-cols-2");
    // Short options would normally sit 2-up; beside a passage they always go one per line.
    expect(screen.getByTestId("question-options")).not.toHaveClass("grid");
    expect(screen.getByRole("button", { name: "Passage" })).toBeInTheDocument();
  });

  it("keeps a hidden passage hidden on the next question of the same passage", async () => {
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: /^Next/ }));
    await user.click(screen.getByRole("button", { name: /^The Bee/ }));
    expect(screen.getByRole("button", { name: /^The Bee/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("question-layout").className).not.toContain("lg:grid-cols-2");

    await user.click(screen.getByRole("button", { name: /^Next/ }));
    expect(screen.getByText("Question q3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^The Bee/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("reads the passage full screen and comes back to the question", async () => {
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: /^Next/ }));
    await user.click(screen.getByRole("button", { name: "Passage" }));

    const reader = screen.getByRole("dialog", { name: "The Bee" });
    expect(within(reader).getByText("Bees dance.")).toBeInTheDocument();
    await user.click(within(reader).getByRole("button", { name: "Back to question 2" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an instruction as a callout with no split view", async () => {
    const user = userEvent.setup();
    renderRunner();
    await user.click(screen.getByRole("button", { name: /Question 4/ }));

    expect(screen.getByRole("region", { name: "Instruction 1, Question 4" })).toHaveTextContent("Choose TRUE or FALSE.");
    expect(screen.getByTestId("question-layout").className).not.toContain("lg:grid-cols-2");
    expect(screen.queryByRole("button", { name: "Passage" })).not.toBeInTheDocument();
  });

  it("groups a passage's numbers in the navigator", () => {
    renderRunner();
    const group = screen.getByRole("group", { name: "Passage 1, questions 2–3" });
    expect(within(group).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Question 2, Passage 1, not answered" })).toBeInTheDocument();
  });
});
