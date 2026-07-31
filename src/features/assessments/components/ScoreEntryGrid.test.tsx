import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assessmentsApi from "@/api/assessments";
import type { AssessmentSheetView } from "@/api/assessments";
import { ScoreEntryGrid } from "@/features/assessments/components/ScoreEntryGrid";

vi.mock("@/api/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/api/assessments")>("@/api/assessments");
  return { ...actual, saveScores: vi.fn() };
});

const SHEET: AssessmentSheetView = {
  classId: "class-1",
  subjectId: "subject-1",
  termId: "term-1",
  assessmentMode: "NUMERIC",
  quizWeight: 30,
  examWeight: 70,
  quizMax: 20,
  examMax: 80,
  quizEnabled: true,
  boundaries: [
    { grade: "A", minScore: 70, maxScore: 100, remark: "Excellent" },
    { grade: "F", minScore: 0, maxScore: 69.99, remark: "Fail" },
  ],
  ratingOptions: [],
  rows: [
    {
      enrollmentId: "enrollment-1",
      studentName: "Ada Obi",
      admissionNumber: "SCH/2026/0001",
      quizScore: undefined,
      examScore: undefined,
      finalScore: undefined,
      grade: undefined,
      remark: undefined,
    },
  ],
};

function renderGrid(onSaved = vi.fn()) {
  const router = createMemoryRouter(
    [{ path: "/", element: <ScoreEntryGrid sheet={SHEET} onSaved={onSaved} /> }],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return { onSaved };
}

describe("ScoreEntryGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes the final score and grade live as marks are typed, before saving", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.type(screen.getByLabelText(/Quiz/), "20");
    await user.type(screen.getByLabelText(/Exam/), "80");

    // quiz 20/20 -> 100% * 30 = 30; exam 80/80 -> 100% * 70 = 70; total 100.
    expect(await screen.findByText("100")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(assessmentsApi.saveScores).not.toHaveBeenCalled();
  });

  it("shows the unsaved-changes count only once a cell has been edited", async () => {
    const user = userEvent.setup();
    renderGrid();

    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Quiz/), "15");

    expect(await screen.findByText("1 unsaved change")).toBeInTheDocument();
  });

  it("saves only the dirty rows and reports the outcome", async () => {
    const user = userEvent.setup();
    vi.mocked(assessmentsApi.saveScores).mockResolvedValue({
      outcomes: [{ enrollmentId: "enrollment-1", success: true }],
    });
    const { onSaved } = renderGrid();

    await user.type(screen.getByLabelText(/Quiz/), "18");
    await user.type(screen.getByLabelText(/Exam/), "70");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(assessmentsApi.saveScores).toHaveBeenCalledWith("class-1", "subject-1", "term-1", [
      { enrollmentId: "enrollment-1", quizScore: 18, examScore: 70 },
    ]);
    expect(onSaved).toHaveBeenCalledWith([{ enrollmentId: "enrollment-1", success: true }]);
  });

  it("flags a mark outside the allowed range without blocking other rows", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.type(screen.getByLabelText(/Quiz/), "25");

    expect(await screen.findByText("Must be between 0 and 20.")).toBeInTheDocument();
  });
});
