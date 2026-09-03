import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assessmentsApi from "@/api/assessments";
import type { AssessmentSheetView } from "@/api/assessments";
import { RatingEntryGrid } from "@/features/assessments/components/RatingEntryGrid";

vi.mock("@/api/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/api/assessments")>("@/api/assessments");
  return { ...actual, saveRatings: vi.fn() };
});

const SHEET: AssessmentSheetView = {
  classId: "class-1",
  subjectId: "subject-1",
  termId: "term-1",
  assessmentMode: "QUALITATIVE",
  showMidtermGrade: true,
  boundaries: [],
  ratingOptions: [
    { id: "rating-1", label: "Needs Reinforcement", rank: 1 },
    { id: "rating-2", label: "Meets Expectation", rank: 2 },
  ],
  rows: [
    {
      enrollmentId: "enrollment-1",
      studentName: "Zara Bello",
      admissionNumber: "SCH/2026/0001",
    },
  ],
};

function renderGrid(onSaved = vi.fn()) {
  const router = createMemoryRouter(
    [{ path: "/", element: <RatingEntryGrid sheet={SHEET} onSaved={onSaved} /> }],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return { onSaved };
}

describe("RatingEntryGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("round-trips an end-of-term rating and observation to the save payload", async () => {
    const user = userEvent.setup();
    vi.mocked(assessmentsApi.saveRatings).mockResolvedValue({
      outcomes: [{ enrollmentId: "enrollment-1", success: true }],
    });
    const { onSaved } = renderGrid();

    await user.selectOptions(screen.getByLabelText("End-of-term rating for Zara Bello"), "rating-2");
    await user.type(screen.getByLabelText("End-of-term observation for Zara Bello"), "Settling in well");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(assessmentsApi.saveRatings).toHaveBeenCalledWith("class-1", "subject-1", "term-1", [
      {
        enrollmentId: "enrollment-1",
        midtermRatingOptionId: null,
        midtermObservation: null,
        ratingOptionId: "rating-2",
        observation: "Settling in well",
      },
    ]);
    expect(onSaved).toHaveBeenCalledWith([{ enrollmentId: "enrollment-1", success: true }]);
  });

  it("saves a mid-term-only rating, leaving the end-of-term pair null", async () => {
    const user = userEvent.setup();
    vi.mocked(assessmentsApi.saveRatings).mockResolvedValue({
      outcomes: [{ enrollmentId: "enrollment-1", success: true }],
    });
    const { onSaved } = renderGrid();

    await user.selectOptions(screen.getByLabelText("Midterm rating for Zara Bello"), "rating-1");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(assessmentsApi.saveRatings).toHaveBeenCalledWith("class-1", "subject-1", "term-1", [
      {
        enrollmentId: "enrollment-1",
        midtermRatingOptionId: "rating-1",
        midtermObservation: null,
        ratingOptionId: null,
        observation: null,
      },
    ]);
    expect(onSaved).toHaveBeenCalledWith([{ enrollmentId: "enrollment-1", success: true }]);
  });

  it("shows no score, grade, or total anywhere in a qualitative row", () => {
    renderGrid();

    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/position/i)).not.toBeInTheDocument();
  });
});
