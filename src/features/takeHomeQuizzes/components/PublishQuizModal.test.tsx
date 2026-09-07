import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as takeHomeQuizzesApi from "@/api/takeHomeQuizzes";
import { PublishQuizModal } from "@/features/takeHomeQuizzes/components/PublishQuizModal";

vi.mock("@/api/takeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/takeHomeQuizzes")>("@/api/takeHomeQuizzes");
  return {
    ...actual,
    publishTakeHomeQuiz: vi.fn(),
  };
});

beforeEach(() => vi.clearAllMocks());

describe("PublishQuizModal", () => {
  it("shows the roster size and close time before publishing", () => {
    render(
      <PublishQuizModal
        open
        onClose={vi.fn()}
        quizId="quiz-1"
        rosterSize={30}
        closesAt="2026-03-08T00:00:00Z"
        onPublished={vi.fn()}
      />,
    );

    expect(screen.getByText("30", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("publishes and shows the outcome, including a failed row", async () => {
    const onPublished = vi.fn();
    vi.mocked(takeHomeQuizzesApi.publishTakeHomeQuiz).mockResolvedValue({
      tokensMinted: 2,
      guardiansNotified: 1,
      perStudent: [
        { studentId: "student-2", studentName: "Bola Ade", success: false, message: "No active guardian contact - copy this student's link manually." },
      ],
    });
    render(
      <PublishQuizModal
        open
        onClose={vi.fn()}
        quizId="quiz-1"
        rosterSize={2}
        closesAt="2026-03-08T00:00:00Z"
        onPublished={onPublished}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("2", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Bola Ade")).toBeInTheDocument();
    expect(screen.getByText(/No active guardian contact/)).toBeInTheDocument();
    expect(takeHomeQuizzesApi.publishTakeHomeQuiz).toHaveBeenCalledWith("quiz-1");
    expect(onPublished).toHaveBeenCalled();
  });
});
