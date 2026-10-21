import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizAttemptView } from "@/api/publicTakeHomeQuiz";
import { QuizRunner } from "@/features/takeHomeQuizzes/runner/QuizRunner";
import type { QuizTransport } from "@/features/takeHomeQuizzes/runner/quizTransport";

function choice(id: string, position: number) {
  return {
    id,
    position,
    questionType: "SINGLE_CHOICE" as const,
    prompt: `<p>Question ${id}</p>`,
    points: 1,
    options: [
      { id: `${id}-a`, position: 1, label: `${id} yes` },
      { id: `${id}-b`, position: 2, label: `${id} no` },
    ],
  };
}

const attempt: QuizAttemptView = {
  questions: [choice("q1", 1), choice("q2", 2), choice("q3", 3), choice("q4", 4)],
  answers: {},
  deadlineAt: null,
  serverTime: "2026-01-01T00:00:00Z",
};

function transport(): QuizTransport {
  return {
    bufferKey: `test-${crypto.randomUUID()}`,
    saveAnswers: vi.fn(async () => attempt),
    submit: vi.fn(async () => ({ alreadySubmitted: false, revealResults: false, serverTime: "" })),
    renderQuestionImage: () => null,
  };
}

describe("QuizRunner submit gate", () => {
  beforeEach(() => localStorage.clear());

  it("keeps Submit disabled until every question is answered, walking back through the gaps in order", async () => {
    const user = userEvent.setup();
    const quiz = transport();
    const onSubmitted = vi.fn();
    render(<QuizRunner initialAttempt={attempt} transport={quiz} onSubmitted={onSubmitted} onError={vi.fn()} />);

    // Answer q1 and q3, skip q2 and q4, and reach the end.
    await user.click(screen.getByRole("radio", { name: "q1 yes" }));
    await user.click(screen.getByRole("button", { name: /^Next/ }));
    expect(screen.queryByRole("button", { name: "Submit quiz" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Next/ }));
    await user.click(screen.getByRole("radio", { name: "q3 yes" }));
    await user.click(screen.getByRole("button", { name: /^Next/ }));

    expect(screen.getByText("Question q4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit quiz" })).toBeDisabled();
    expect(screen.getByText("Answer 2 more questions to submit")).toBeInTheDocument();

    // Wraps round to the first gap.
    await user.click(screen.getByRole("button", { name: /Next unanswered/ }));
    expect(screen.getByText("Question q2")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "q2 yes" }));

    // Then on to the next one, skipping answered q3.
    await user.click(screen.getByRole("button", { name: /Next unanswered/ }));
    expect(screen.getByText("Question q4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next unanswered/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit quiz" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "q4 yes" }));
    expect(screen.getByRole("button", { name: "Submit quiz" })).toBeEnabled();
    expect(screen.getByText("All done! Ready to submit.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit quiz" }));
    const dialog = await screen.findByRole("dialog", { name: "Submit quiz?" });
    await user.click(within(dialog).getByRole("button", { name: "Submit quiz" }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(quiz.submit).toHaveBeenCalledTimes(1);
  });

  it("offers Submit from any question once the end has been reached", async () => {
    const user = userEvent.setup();
    render(<QuizRunner initialAttempt={attempt} transport={transport()} onSubmitted={vi.fn()} onError={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Question 4, not answered" }));
    await user.click(screen.getByRole("button", { name: "Question 1, not answered" }));

    expect(screen.getByRole("button", { name: "Submit quiz" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Next unanswered/ }));
    expect(screen.getByText("Question q2")).toBeInTheDocument();
  });

  it("still auto-submits a partly answered attempt when time runs out", async () => {
    const quiz = transport();
    const onSubmitted = vi.fn();
    render(
      <QuizRunner
        initialAttempt={{ ...attempt, deadlineAt: "2025-12-31T23:59:00Z" }}
        transport={quiz}
        onSubmitted={onSubmitted}
        onError={vi.fn()}
      />,
    );

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(quiz.submit).toHaveBeenCalledWith([]);
  });
});
