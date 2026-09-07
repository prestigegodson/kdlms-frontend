import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as takeHomeQuizzesApi from "@/api/takeHomeQuizzes";
import { AdjustScoreModal } from "@/features/takeHomeQuizzes/components/AdjustScoreModal";

vi.mock("@/api/takeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/takeHomeQuizzes")>("@/api/takeHomeQuizzes");
  return {
    ...actual,
    adjustTakeHomeQuizScore: vi.fn(),
  };
});

beforeEach(() => vi.clearAllMocks());

function renderModal(onAdjusted = vi.fn()) {
  render(
    <AdjustScoreModal
      quizId="quiz-1"
      studentId="student-1"
      studentName="Ada Okoye"
      currentScore={10}
      totalPoints={10}
      onClose={vi.fn()}
      onAdjusted={onAdjusted}
    />,
  );
  return onAdjusted;
}

describe("AdjustScoreModal", () => {
  it("disables submit while the reason is blank", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Save adjustment" })).toBeDisabled();
  });

  it("disables submit when the score is outside [0, totalPoints]", async () => {
    renderModal();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Reason/), "Question was ambiguous");
    const scoreInput = screen.getByLabelText(/Score/);
    await user.clear(scoreInput);
    await user.type(scoreInput, "15");

    expect(screen.getByRole("button", { name: "Save adjustment" })).toBeDisabled();
  });

  it("submits the trimmed reason and new score once both are valid", async () => {
    const onAdjusted = renderModal();
    vi.mocked(takeHomeQuizzesApi.adjustTakeHomeQuizScore).mockResolvedValue({
      studentId: "student-1",
      fullName: "Ada Okoye",
      admissionNumber: "T2026/0001",
      attemptState: "SUBMITTED",
      autoScore: 10,
      adjustedScore: 7,
      effectiveScore: 7,
      submittedAt: "2026-03-01T00:00:00Z",
      autoSubmitted: false,
      resetCount: 0,
    });
    const user = userEvent.setup();

    const scoreInput = screen.getByLabelText(/Score/);
    await user.clear(scoreInput);
    await user.type(scoreInput, "7");
    await user.type(screen.getByLabelText(/Reason/), "  Question was ambiguously worded  ");
    await user.click(screen.getByRole("button", { name: "Save adjustment" }));

    await waitFor(() =>
      expect(takeHomeQuizzesApi.adjustTakeHomeQuizScore).toHaveBeenCalledWith("quiz-1", "student-1", {
        newScore: 7,
        reason: "Question was ambiguously worded",
      }),
    );
    expect(onAdjusted).toHaveBeenCalled();
  });
});
