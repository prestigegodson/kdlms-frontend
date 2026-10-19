import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuizPreviewModal } from "@/features/takeHomeQuizzes/components/QuizPreviewModal";
import type { EditableQuestion } from "@/features/takeHomeQuizzes/editableQuestion";

vi.mock("@/components/richText/AuthenticatedRichImage", () => ({ AuthenticatedRichImage: () => null }));

const questions: EditableQuestion[] = [
  {
    key: "q1",
    id: null,
    questionType: "SINGLE_CHOICE",
    prompt: "<p>Capital of Nigeria?</p>",
    points: "1",
    options: [
      { key: "a", id: null, label: "<p>Lagos</p>", correct: false },
      { key: "b", id: null, label: "<p>Abuja</p>", correct: true },
    ],
    answerKeys: [],
    tags: [],
    interaction: null,
    scoring: null,
    stimulusKey: null,
  },
];

describe("QuizPreviewModal", () => {
  it("runs the quiz in memory, then reviews a client-scored result and leaves nothing buffered", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <QuizPreviewModal
        title="Geography"
        instructions=""
        timed={false}
        durationMinutes={null}
        shuffleQuestions={false}
        shuffleChoices={false}
        questions={questions}
        theme={null}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Start preview" }));
    await user.click(screen.getByText("Abuja"));
    await user.click(screen.getByRole("button", { name: "Submit quiz" }));
    const dialog = await screen.findByRole("dialog", { name: "Submit quiz?" });
    await user.click(within(dialog).getByRole("button", { name: "Submit quiz" }));

    expect(await screen.findByText(/would score 1 of 1 points/)).toBeInTheDocument();
    expect(Object.keys(localStorage).filter((key) => key.startsWith("thq:preview:"))).toEqual([]);
  });
});
