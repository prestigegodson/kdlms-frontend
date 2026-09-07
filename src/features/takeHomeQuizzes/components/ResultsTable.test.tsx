import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StudentResultRowView } from "@/api/takeHomeQuizzes";
import { ResultsTable } from "@/features/takeHomeQuizzes/components/ResultsTable";

const submittedRow: StudentResultRowView = {
  studentId: "student-1",
  fullName: "Ada Okoye",
  admissionNumber: "T2026/0001",
  attemptState: "SUBMITTED",
  autoScore: 10,
  adjustedScore: null,
  effectiveScore: 10,
  submittedAt: "2026-03-01T00:00:00Z",
  autoSubmitted: false,
  resetCount: 0,
};

const notStartedRow: StudentResultRowView = {
  studentId: "student-2",
  fullName: "Bola Ade",
  admissionNumber: "T2026/0002",
  attemptState: "NOT_STARTED",
  autoScore: null,
  adjustedScore: null,
  effectiveScore: null,
  submittedAt: null,
  autoSubmitted: false,
  resetCount: 0,
};

const adjustedRow: StudentResultRowView = {
  ...submittedRow,
  studentId: "student-3",
  fullName: "Chidi Nwosu",
  adjustedScore: 7,
  effectiveScore: 7,
};

describe("ResultsTable", () => {
  it("shows an adjusted badge and the auto score alongside an adjusted one", () => {
    render(
      <ResultsTable
        rows={[adjustedRow]}
        totalPoints={10}
        canAdjust
        canReset
        onViewAnswers={vi.fn()}
        onAdjust={vi.fn()}
        onClearAdjustment={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText("Adjusted")).toBeInTheDocument();
    expect(screen.getByText("7 / 10")).toBeInTheDocument();
    expect(screen.getByText("Auto: 10 / 10")).toBeInTheDocument();
  });

  it("hides Adjust/Reset actions when the caller isn't permitted", () => {
    render(
      <ResultsTable
        rows={[submittedRow]}
        totalPoints={10}
        canAdjust={false}
        canReset={false}
        onViewAnswers={vi.fn()}
        onAdjust={vi.fn()}
        onClearAdjustment={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "View answers" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjust" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("never shows Reset for a student who hasn't started, and never shows View answers for them either", () => {
    render(
      <ResultsTable
        rows={[notStartedRow]}
        totalPoints={10}
        canAdjust
        canReset
        onViewAnswers={vi.fn()}
        onAdjust={vi.fn()}
        onClearAdjustment={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View answers" })).not.toBeInTheDocument();
  });

  it("invokes the adjust callback with the row when Adjust is clicked", async () => {
    const onAdjust = vi.fn();
    render(
      <ResultsTable
        rows={[submittedRow]}
        totalPoints={10}
        canAdjust
        canReset
        onViewAnswers={vi.fn()}
        onAdjust={onAdjust}
        onClearAdjustment={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Adjust" }));

    expect(onAdjust).toHaveBeenCalledWith(submittedRow);
  });
});
