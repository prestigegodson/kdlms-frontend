import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assessmentsApi from "@/api/assessments";
import type { ClassAssessmentSheetView } from "@/api/assessments";
import { AllSubjectsEntryGrid } from "@/features/assessments/components/AllSubjectsEntryGrid";

vi.mock("@/api/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/api/assessments")>("@/api/assessments");
  return { ...actual, saveClassRatings: vi.fn(), saveClassScores: vi.fn() };
});

const RATING_SHEET: ClassAssessmentSheetView = {
  classId: "class-1",
  termId: "term-1",
  assessmentMode: "QUALITATIVE",
  ratingOptions: [
    { id: "rating-1", label: "Needs Reinforcement", rank: 1 },
    { id: "rating-2", label: "Meets Expectation", rank: 2 },
  ],
  subjects: [
    {
      subjectId: "numeracy",
      name: "Numeracy",
      subjectGroupId: "group-1",
      subjectGroupName: "Core",
      assessmentPeriods: "BOTH",
    },
    {
      subjectId: "literacy",
      name: "Literacy",
      subjectGroupId: "group-1",
      subjectGroupName: "Core",
      assessmentPeriods: "MIDTERM_ONLY",
    },
    { subjectId: "french", name: "French", assessmentPeriods: "BOTH" },
  ],
  students: [
    { enrollmentId: "e-1", studentName: "Adebayo Tolu", admissionNumber: "SCH/0001" },
    { enrollmentId: "e-2", studentName: "Okafor Chidera", admissionNumber: "SCH/0002" },
  ],
  cells: [
    {
      enrollmentId: "e-1",
      subjectId: "numeracy",
      offered: true,
      midtermRatingOptionId: "rating-1",
      ratingOptionId: "rating-2",
    },
    { enrollmentId: "e-2", subjectId: "numeracy", offered: true },
    { enrollmentId: "e-1", subjectId: "literacy", offered: true },
    { enrollmentId: "e-2", subjectId: "literacy", offered: true },
    { enrollmentId: "e-1", subjectId: "french", offered: true },
    { enrollmentId: "e-2", subjectId: "french", offered: false },
  ],
};

function renderGrid(sheet: ClassAssessmentSheetView = RATING_SHEET, onSaved = vi.fn()) {
  const router = createMemoryRouter(
    [{ path: "/", element: <AllSubjectsEntryGrid sheet={sheet} onSaved={onSaved} /> }],
    {
      initialEntries: ["/"],
    },
  );
  render(<RouterProvider router={router} />);
  return { onSaved };
}

describe("AllSubjectsEntryGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists subjects down the side under their groups and students across the top", () => {
    renderGrid();

    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual(["Subject", "Adebayo ToluSCH/0001", "Okafor ChideraSCH/0002"]);
    const rowText = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0].textContent);
    expect(rowText).toEqual(["Core", "1.Literacy", "2.Numeracy", "Other subjects", "3.French"]);
  });

  it("keeps the list flat when no subject is grouped", () => {
    renderGrid({
      ...RATING_SHEET,
      subjects: RATING_SHEET.subjects.map((s) => ({
        ...s,
        subjectGroupId: undefined,
        subjectGroupName: undefined,
      })),
    });

    expect(screen.queryByText("Other subjects")).not.toBeInTheDocument();
    expect(screen.queryByText("Core")).not.toBeInTheDocument();
  });

  it("shows the selected period's values and switches on the toggle", async () => {
    const user = userEvent.setup();
    renderGrid();

    expect(screen.getByLabelText("Mid-term rating for Adebayo Tolu in Numeracy")).toHaveValue(
      "rating-1",
    );
    await user.click(screen.getByRole("radio", { name: "End of term" }));
    expect(screen.getByLabelText("End of term rating for Adebayo Tolu in Numeracy")).toHaveValue(
      "rating-2",
    );
  });

  it("locks cells a student doesn't offer", () => {
    renderGrid();

    expect(
      screen.getByLabelText("Okafor Chidera, French: Doesn't offer this subject"),
    ).toBeInTheDocument();
  });

  it("hides a MIDTERM_ONLY subject at end of term", async () => {
    const user = userEvent.setup();
    renderGrid();

    expect(
      screen.getByLabelText("Mid-term rating for Adebayo Tolu in Literacy"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "End of term" }));
    expect(screen.queryByText("Literacy")).not.toBeInTheDocument();
    const rowText = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0].textContent);
    expect(rowText).toEqual(["Core", "1.Numeracy", "Other subjects", "2.French"]);
    expect(
      screen.getByLabelText("Okafor Chidera, French: Doesn't offer this subject"),
    ).toBeInTheDocument();
  });

  it("hides an EXAM_ONLY subject at mid-term", async () => {
    const user = userEvent.setup();
    renderGrid({
      ...RATING_SHEET,
      subjects: RATING_SHEET.subjects.map((s) =>
        s.subjectId === "french" ? { ...s, assessmentPeriods: "EXAM_ONLY" } : s,
      ),
    });

    expect(screen.queryByText("French")).not.toBeInTheDocument();
    expect(screen.queryByText("Other subjects")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "End of term" }));
    expect(
      screen.getByLabelText("End of term rating for Adebayo Tolu in French"),
    ).toBeInTheDocument();
  });

  it("says so when no subject is assessed in the selected period", () => {
    renderGrid({
      ...RATING_SHEET,
      subjects: RATING_SHEET.subjects.map((s) => ({ ...s, assessmentPeriods: "EXAM_ONLY" })),
    });

    expect(screen.getByText("No graded subjects are assessed at mid-term.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("saves only the dirty cells, for the selected period", async () => {
    const user = userEvent.setup();
    vi.mocked(assessmentsApi.saveClassRatings).mockResolvedValue({
      outcomes: [{ enrollmentId: "e-2", subjectId: "numeracy", success: true }],
    });
    const { onSaved } = renderGrid();

    await user.selectOptions(
      screen.getByLabelText("Mid-term rating for Okafor Chidera in Numeracy"),
      "rating-2",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(assessmentsApi.saveClassRatings).toHaveBeenCalledWith("class-1", "term-1", "MIDTERM", [
      { enrollmentId: "e-2", subjectId: "numeracy", ratingOptionId: "rating-2" },
    ]);
    expect(onSaved).toHaveBeenCalledWith([
      { enrollmentId: "e-2", subjectId: "numeracy", success: true },
    ]);
  });

  it("asks before switching period with unsaved changes", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.selectOptions(
      screen.getByLabelText("Mid-term rating for Okafor Chidera in Numeracy"),
      "rating-2",
    );
    await user.click(screen.getByRole("radio", { name: "End of term" }));

    expect(await screen.findByText("Switch period without saving?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Switch" }));
    expect(
      await screen.findByLabelText("End of term rating for Okafor Chidera in Numeracy"),
    ).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("records exam marks for a numeric class", async () => {
    const user = userEvent.setup();
    vi.mocked(assessmentsApi.saveClassScores).mockResolvedValue({ outcomes: [] });
    renderGrid({
      ...RATING_SHEET,
      assessmentMode: "NUMERIC",
      quizMax: 30,
      examMax: 70,
      ratingOptions: [],
      cells: RATING_SHEET.cells.map((cell) => ({
        ...cell,
        midtermRatingOptionId: undefined,
        ratingOptionId: undefined,
        quizScore: 20,
      })),
    });

    await user.click(screen.getByRole("radio", { name: "End of term" }));
    expect(screen.getByText("Exam marks, out of 70.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("End of term mark for Adebayo Tolu in Numeracy"), "56");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(assessmentsApi.saveClassScores).toHaveBeenCalledWith("class-1", "term-1", "TERM", [
      { enrollmentId: "e-1", subjectId: "numeracy", score: 56 },
    ]);
  });
});
